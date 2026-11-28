"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { action } from "@/lib/action";
import { domainError, isDomainError } from "@/lib/errors";
import { avisarSinBloquear } from "@/modules/orders/avisar";
import { crearOrdenDesdeCarrito, type Entrega } from "@/modules/orders/crear";
import { cancelarOrden } from "@/modules/orders/estados";
import { idDeMiOrden } from "@/modules/orders/queries";
import {
  confirmacionSchema,
  type Confirmacion,
} from "@/modules/orders/schemas";
import { emailConfirmado } from "@/modules/users/verificacion";

/**
 * Confirmar el pedido (TECHNICAL-SPEC §8.4). El `userId` sale de la sesión,
 * nunca de la entrada.
 *
 * No llama a `refresh()`: refrescaría el checkout, que con el carrito vacío
 * redirige al carrito y compite con la navegación a la orden.
 */
export const confirmarPedido = action
  .input(confirmacionSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const { identity, profile } = ctx.session;

    // En la base y no en la sesión, que el usuario puede escribir.
    if (!(await emailConfirmado(profile.id))) {
      throw domainError("EMAIL_NOT_VERIFIED");
    }

    const orden = await crearOrdenDesdeCarrito({
      userId: profile.id,
      idempotencyKey: input.idempotencyKey,
      entrega: entregaElegida(input),
      customerName: input.nombre,
      customerEmail: identity.email ?? profile.email,
      customerPhone: input.telefono,
      esperado: input.esperado,
    }).catch((e: unknown) => {
      // El único NOT_FOUND posible es la dirección (borrada desde otra
      // pestaña): el aviso va en su campo.
      if (isDomainError(e) && e.code === "NOT_FOUND") {
        throw domainError("NOT_FOUND", {
          message: DIRECCION_QUE_YA_NO_ESTA,
          fields: {
            properties: { addressId: { errors: [DIRECCION_QUE_YA_NO_ESTA] } },
          },
        });
      }
      throw e;
    });

    // Un reintento idempotente devuelve la orden existente: no se avisa de nuevo.
    if (!orden.yaExistia) avisarSinBloquear(orden.orderId);

    return { numero: orden.orderNumber };
  });

const DIRECCION_QUE_YA_NO_ESTA =
  "Esa dirección ya no está en tu libreta. Elegí otra o cargá una nueva.";

function entregaElegida(input: Confirmacion): Entrega {
  if (input.entrega === "retiro") return { tipo: "retiro" };
  // El esquema ya lo exige; esto es para el tipo.
  if (!input.addressId) throw domainError("VALIDATION");
  return { tipo: "envio", addressId: input.addressId };
}

/** El arrepentimiento del comprador (RF-34): sin motivo, y solo sobre su orden. */
export const cancelarMiOrden = action
  .input(z.object({ numero: z.number().int().positive() }))
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeMiOrden(ctx.session.profile.id, input.numero);
    if (!orderId) throw domainError("NOT_FOUND");

    await db.transaction((tx) =>
      cancelarOrden(tx, {
        orderId,
        // Que el autor sea el comprador distingue el arrepentimiento en el panel.
        actorUserId: ctx.session.profile.id,
      }),
    );

    refresh();
    return { cancelada: input.numero };
  });
