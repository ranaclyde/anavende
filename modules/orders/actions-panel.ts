"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { quitarItem, reducirCantidad } from "@/modules/orders/editar";
import { cancelarOrden, finalizarOrden } from "@/modules/orders/estados";
import { idDeLaOrden } from "@/modules/orders/queries-panel";
import {
  cancelacionDelPanel,
  laOrdenDelPanel,
} from "@/modules/orders/schemas-panel";

/**
 * Acciones del panel sobre una orden — FS RF-22, RF-23 · TS §8.1.
 * Tareas F7.2 (editar) y F7.3 (finalizar y cancelar).
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
 * envoltorio en las dos. Se separan porque conviven dos «cancelar» que se
 * parecen y no son lo mismo —el arrepentimiento de RF-23 vive en `actions.ts`
 * y la decisión de la vendedora acá—, y un archivo con las dos mezcladas se
 * lee peor.
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

// ── Resolver la orden: finalizar o cancelar (RF-23) ─────────────────────

/**
 * Finalizar una orden activa — RF-23. Tarea F7.3.
 *
 * **La venta se concretó**: `finalizarOrden` descuenta el stock real y suelta
 * la reserva de una (§8.1), escribe el historial en la misma transacción y
 * usa un `UPDATE` condicional por estado, así que dos «Finalizar» a la vez
 * dan un ganador y un `INVALID_ORDER_STATE` — el perdedor no llega a tocar el
 * stock. Todo eso es de F4.2 y está probado en `estados.test.ts`.
 *
 * **Sin motivo, y no por olvido.** RF-23 lo pide para la cancelación, que es
 * la que necesita explicarse. Finalizar es el curso normal de una orden: el
 * motivo sería un campo que siempre se deja vacío.
 *
 * **Sólo la administradora.** Finalizar es afirmar que se entregó, y el
 * comprador no puede hacerlo ni por su propia orden: lo único suyo es
 * arrepentirse (`cancelarMiOrden`, F6.5).
 */
export const finalizarLaOrden = action
  .input(laOrdenDelPanel)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeLaOrdenO404(input.numero);

    await db.transaction((tx) =>
      finalizarOrden(tx, { orderId, actorUserId: ctx.session.profile.id }),
    );

    refresh();
    return { numero: input.numero };
  });

/**
 * Cancelar una orden activa desde el panel — RF-23. Tarea F7.3.
 *
 * **No es `cancelarMiOrden` con otro rol.** Aquélla es el arrepentimiento
 * (RF-34): la pide quien compró, sobre su propia orden, sin explicaciones y
 * buscando por dueño además de por número (§13.8). Ésta es una decisión de la
 * vendedora sobre la orden de otra persona —no hay stock, no se pudo
 * coordinar—, y por eso puede llevar motivo y no filtra por nadie. El dominio
 * que las dos llaman es el mismo (`cancelarOrden`), y lo que las distingue
 * después es el autor que queda en el historial, que es exactamente lo que
 * RF-23 pidió que se registrara.
 *
 * **El motivo lo lee el comprador**, en el detalle de su compra: decisión
 * tuya del 2026-09-16. Hasta hoy la única cancelación posible era la suya, y
 * la pantalla le decía «Cancelaste este pedido»; ahora distingue quién fue y,
 * si la vendedora escribió por qué, se lo muestra en lugar de dejarlo
 * preguntando por WhatsApp. El diálogo avisa que se publica, porque un campo
 * que se cree interno y no lo sea es peor que no tenerlo.
 */
export const cancelarLaOrden = action
  .input(cancelacionDelPanel)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeLaOrdenO404(input.numero);

    await db.transaction((tx) =>
      cancelarOrden(tx, {
        orderId,
        actorUserId: ctx.session.profile.id,
        // **Vacío es `null`, no la cadena vacía.** Un `reason = ''` se lee
        // como «hay un motivo» en toda consulta que pregunte si lo hay, y
        // termina siendo un «Motivo:» sin nada al lado en dos pantallas.
        // El esquema ya le pasó el `trim`, así que esto atrapa el campo que
        // se abrió, se tocó y se dejó en blanco.
        reason: input.motivo || null,
      }),
    );

    refresh();
    return { numero: input.numero };
  });
