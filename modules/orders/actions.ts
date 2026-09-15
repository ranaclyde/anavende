"use server";

import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { crearOrdenDesdeCarrito, type Entrega } from "@/modules/orders/crear";
import { confirmacionSchema, type Confirmacion } from "@/modules/orders/schemas";

/**
 * Confirmar el pedido — FS RF-11, RF-12 · TS §8.4, §8.5. Tarea F6.1.
 *
 * Es `customer`, así que el envoltorio ya rechazó a quien no tiene sesión, a
 * quien está bloqueado y a quien pidió la baja (paso 2b). El `userId` sale de
 * la sesión y nunca de la entrada (§13.8).
 *
 * **Lo que NO hace, y es de otras tareas:** el email E4 a la administradora es
 * F6.4 y va acá, después de crear la orden y fuera de su transacción (§8.4
 * paso 10). El `revalidateTag` del paso 11 no hace falta todavía: la tienda no
 * cachea nada por etiqueta (§12).
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
    });

    return { numero: orden.orderNumber };
  });

function entregaElegida(input: Confirmacion): Entrega {
  if (input.entrega === "retiro") return { tipo: "retiro" };
  // El esquema ya lo exige; esto es para que el tipo lo sepa.
  if (!input.addressId) throw domainError("VALIDATION");
  return { tipo: "envio", addressId: input.addressId };
}
