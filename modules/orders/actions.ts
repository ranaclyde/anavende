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

/**
 * Confirmar el pedido — FS RF-11, RF-12 · TS §8.4, §8.5. Tarea F6.1.
 *
 * Es `customer`, así que el envoltorio ya rechazó a quien no tiene sesión, a
 * quien está bloqueado y a quien pidió la baja (paso 2b). El `userId` sale de
 * la sesión y nunca de la entrada (§13.8).
 *
 * **El email E4 sale después de la respuesta** (F6.4, §8.4 paso 10), no solo
 * fuera de la transacción: armar el HTML y hablar con Resend son un par de
 * segundos que no tienen por qué pasar con el comprador mirando un botón
 * girando, cuando la orden ya está hecha y nada de lo que pase ahí cambia lo
 * que él ve. Quién lo agenda y por qué no puede fallar está en
 * `avisarSinBloquear`.
 *
 * **Lo que NO hace:** el `revalidateTag` del paso 11 no hace falta todavía, la
 * tienda no cachea nada por etiqueta (§12).
 *
 * **Tampoco llama a `refresh()`.** Refrescaría el checkout, que con el carrito
 * ya vacío manda al carrito: la respuesta traería una redirección que compite
 * con la navegación a la orden. La pantalla navega sola con el número.
 */
export const confirmarPedido = action
  .input(confirmacionSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const { identity, profile } = ctx.session;

    // RF-11. En la práctica casi no se ve —sin verificar no se puede entrar
    // (RF-05)—, pero una sesión abierta antes de ese cambio, o una cuenta de
    // proveedor social, llegaría hasta acá.
    if (!identity.emailVerified) throw domainError("EMAIL_NOT_VERIFIED");

    const orden = await crearOrdenDesdeCarrito({
      userId: profile.id,
      idempotencyKey: input.idempotencyKey,
      entrega: entregaElegida(input),
      customerName: input.nombre,
      customerEmail: identity.email ?? profile.email,
      customerPhone: input.telefono,
      esperado: input.esperado,
    }).catch((e: unknown) => {
      // La creación solo busca una cosa que puede no estar: la dirección. Si
      // se borró desde otra pestaña, el aviso va en su campo y no como el
      // genérico «No encontramos eso que buscabas» (F6.2).
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

    // Solo cuando la orden nació acá. Un reintento con la misma clave devuelve
    // la que ya existía (§8.5), y avisarla otra vez le mandaría a Ana un
    // segundo email por un pedido que no es nuevo — que es exactamente lo que
    // la idempotencia existe para evitar.
    if (!orden.yaExistia) avisarSinBloquear(orden.orderId);

    return { numero: orden.orderNumber };
  });

const DIRECCION_QUE_YA_NO_ESTA =
  "Esa dirección ya no está en tu libreta. Elegí otra o cargá una nueva.";

function entregaElegida(input: Confirmacion): Entrega {
  if (input.entrega === "retiro") return { tipo: "retiro" };
  // El esquema ya lo exige; esto es para que el tipo lo sepa.
  if (!input.addressId) throw domainError("VALIDATION");
  return { tipo: "envio", addressId: input.addressId };
}

/**
 * Cancelar la propia orden — FS RF-23, RF-07, RF-34 · TS §8.1. Tarea F6.5.
 *
 * **Esto es el arrepentimiento**, y no una función más del panel: RF-34 dejó
 * escrito que para quien tiene sesión, cancelar su orden `activa` *es* el
 * derecho de arrepentimiento, y que su visibilidad es parte del requisito. Por
 * eso vive a la vista en el detalle y no detrás de un menú.
 *
 * **Sin motivo, y es deliberado.** RF-23 se lo pide a la administradora, que
 * cancela la orden de otro y tiene que dejar dicho por qué. A quien se
 * arrepiente no se le pide explicación: un campo obligatorio ahí es una
 * fricción puesta justo donde el requisito quiere que no haya ninguna.
 *
 * **La orden se busca por número Y por dueño** (§13.8). El número está en la
 * URL y es adivinable —son correlativos—, así que la de otro tiene que
 * responder exactamente lo mismo que una que no existe.
 */
export const cancelarMiOrden = action
  .input(z.object({ numero: z.number().int().positive() }))
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeMiOrden(ctx.session.profile.id, input.numero);
    if (!orderId) throw domainError("NOT_FOUND");

    // `cancelarOrden` libera la reserva y escribe el historial en la misma
    // transacción que el cambio de estado (§8.1). Si ya no está activa —la
    // finalizó la vendedora mientras esta pantalla estaba abierta— lanza
    // INVALID_ORDER_STATE, que se lee «Esa orden ya cambió de estado».
    await db.transaction((tx) =>
      cancelarOrden(tx, {
        orderId,
        // Queda en el historial quién la canceló (RF-23). Que el autor sea el
        // propio comprador es lo que después distingue en el panel un
        // arrepentimiento de una cancelación de la vendedora.
        actorUserId: ctx.session.profile.id,
      }),
    );

    // El detalle pasa a «Cancelada» y el listado también: las dos son
    // dinámicas y `refresh()` es lo que las vuelve a pedir.
    refresh();
    return { cancelada: input.numero };
  });
