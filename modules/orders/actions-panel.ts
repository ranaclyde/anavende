"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { quitarItem, reducirCantidad } from "@/modules/orders/editar";
import { idDeLaOrden } from "@/modules/orders/queries-panel";

/**
 * Acciones del panel sobre una orden — FS RF-22 · TS §8.1. Tarea F7.2.
 *
 * **La lógica no está acá.** Quitar un renglón y bajar una cantidad ya estaban
 * resueltos y probados en `modules/orders/editar.ts` desde F4.4, con el
 * `FOR UPDATE` sobre la orden, la liberación de la reserva, el recálculo del
 * total en SQL y la fila del historial. Lo que F7.2 agrega es la puerta: rol,
 * validación de la entrada, traducción del número de la URL a un `id`, y el
 * `refresh()` para que la pantalla se vuelva a pedir.
 *
 * **Están separadas de `actions.ts` sólo por dónde viven**, no por una
 * garantía: a diferencia de las consultas —donde el archivo del comprador
 * filtra por `user_id` y el del panel no (§13.8)—, acá la guardia la pone el
 * envoltorio en las dos. Se separan porque F7.3 suma finalizar y cancelar, y
 * un archivo con las acciones del comprador y las de la vendedora mezcladas
 * se lee peor.
 *
 * **El número de la orden viaja en la entrada y el `id` se busca acá.** La
 * URL del panel es `/admin/ordenes/1043`, y hacer que la pantalla mande el
 * `id` obligaría a pasearlo por el cliente sin ninguna ventaja.
 */

const laOrden = z.object({
  numero: z.number().int().positive(),
  /** El renglón, no la variante: una orden puede repetir producto y color. */
  itemId: z.uuid(),
});

/** Traduce el número de la URL, o corta con NOT_FOUND. */
async function idDeLaOrdenO404(numero: number): Promise<string> {
  const orderId = await idDeLaOrden(numero);
  if (!orderId) throw domainError("NOT_FOUND");
  return orderId;
}

/**
 * Quitar un renglón de una orden activa — RF-22.
 *
 * `cancelarSiEsElUltimo` es la **confirmación explícita** que pide RF-22 para
 * el caso en que el renglón que se quita es el único: quitarlo deja una orden
 * sin nada adentro, que no es una orden, y `quitarItem` la cancela. La
 * pantalla ya sabe si es el último y pregunta distinto, pero **quien decide es
 * el dominio**: entre que la pantalla se pintó y llegó el clic, otra pestaña
 * pudo haber quitado los demás renglones, y ahí el pedido llegaría sin la
 * confirmación puesta y la orden se cancelaría sin que nadie lo pidiera.
 */
export const quitarItemDeLaOrden = action
  // Opcional y no `default(false)`: con un `default`, el tipo que ve quien
  // llama exige el campo igual, y lo que se quiere decir es lo contrario —
  // **no mandarlo es no autorizar la cancelación**, que es el caso seguro.
  .input(laOrden.extend({ cancelarSiEsElUltimo: z.boolean().optional() }))
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeLaOrdenO404(input.numero);

    const resultado = await db.transaction((tx) =>
      quitarItem(tx, {
        orderId,
        orderItemId: input.itemId,
        actorUserId: ctx.session.profile.id,
        permitirCancelar: input.cancelarSiEsElUltimo,
      }),
    );

    refresh();
    return resultado;
  });

/**
 * Bajar la cantidad de un renglón — RF-22.
 *
 * Sólo baja: subir unidades hay que reservarlas y el stock puede no estar,
 * así que es su propia operación — **F7.2a**, que llega después de F7.4. Lo
 * rechaza `reducirCantidad`, no este esquema: la cantidad de la que se baja
 * es la de la base, no la que diga el cliente.
 */
export const reducirCantidadDelItem = action
  .input(laOrden.extend({ cantidad: z.number().int().min(1).max(9999) }))
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeLaOrdenO404(input.numero);

    await db.transaction((tx) =>
      reducirCantidad(tx, {
        orderId,
        orderItemId: input.itemId,
        nuevaCantidad: input.cantidad,
        actorUserId: ctx.session.profile.id,
      }),
    );

    refresh();
    return { cantidad: input.cantidad };
  });
