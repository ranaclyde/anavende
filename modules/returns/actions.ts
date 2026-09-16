"use server";

import { refresh } from "next/cache";

import { db } from "@/db";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { idDeLaOrden } from "@/modules/orders/queries-panel";
import {
  anularDevolucion,
  registrarDevolucion,
} from "@/modules/returns/registrar";
import {
  anulacionDeDevolucion,
  devolucionDelPanel,
} from "@/modules/returns/schemas";

/**
 * Acciones del panel sobre devoluciones — FS RF-25 · TS §5.7, §8.1. Tarea F7.5.
 *
 * **La lógica no está acá.** Registrar y anular estaban resueltos y probados
 * en `modules/returns/registrar.ts` desde F4.5, con el `FOR UPDATE` sobre la
 * orden, el tope de «ni más de lo vendido ni de lo ya devuelto», la reposición
 * de stock y la reversión al anular. Lo que F7.5 agrega es la puerta: rol,
 * validación de la entrada, la traducción del número de la URL a un `id` y el
 * `refresh()` para que la pantalla se vuelva a pedir. Es el mismo reparto que
 * F7.3 hizo sobre F4.2.
 *
 * **Sólo la administradora.** No hay ninguna devolución que pida el comprador
 * por su cuenta: FA-15 dice que las registra ella, y lo único del comprador es
 * cancelar mientras la orden esté activa (RF-23).
 */

/**
 * Registrar una devolución contra una orden finalizada — RF-25.
 *
 * **El número de la orden viaja en la entrada y el `id` se busca acá**, como
 * en las acciones de órdenes: la URL del panel es `/admin/ordenes/1043`, y
 * pasear el `id` por el cliente no compra nada.
 *
 * Que la orden esté finalizada lo exige el dominio, no esta puerta: entre que
 * la pantalla se pintó y llegó el clic nada puede volver una orden a activa
 * (RF-13), pero la regla vive donde está el `FOR UPDATE` y no en dos lados.
 */
export const registrarUnaDevolucion = action
  .input(devolucionDelPanel)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeLaOrden(input.numero);
    if (!orderId) throw domainError("NOT_FOUND");

    const { returnId } = await db.transaction((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: input.motivo,
        createdBy: ctx.session.profile.id,
        items: input.items.map((item) => ({
          orderItemId: item.itemId,
          quantity: item.cantidad,
          restocks: item.repone,
          // **Lo que repone no lleva motivo propio**, aunque haya viajado uno:
          // la pantalla sólo pide el del renglón cuando el producto NO vuelve
          // al stock, y un motivo escrito, desmarcado y enviado igual dejaría
          // en la base una explicación de algo que no pasó.
          reason: item.repone ? null : (item.motivo ?? null),
        })),
      }),
    );

    refresh();
    return { returnId };
  });

/**
 * Anular una devolución — RF-25: no se edita, se anula y se vuelve a cargar.
 *
 * `anularDevolucion` revierte lo que había repuesto y libera el cupo, con un
 * `UPDATE` condicional por estado: dos anulaciones simultáneas dan una
 * ganadora, y la perdedora no llega a sacar el stock por segunda vez.
 *
 * **Viaja el `id` de la devolución y no el número de la orden**, al revés de
 * la de arriba: se anula desde el listado general, donde la orden es un dato
 * más de la fila y no la pantalla en la que se está parado.
 */
export const anularUnaDevolucion = action
  .input(anulacionDeDevolucion)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    await db.transaction((tx) =>
      anularDevolucion(tx, {
        returnId: input.returnId,
        voidReason: input.motivo,
        actorUserId: ctx.session.profile.id,
      }),
    );

    refresh();
    return { returnId: input.returnId };
  });
