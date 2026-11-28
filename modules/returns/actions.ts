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

// La lógica vive en `registrar.ts`; esto es la puerta: rol, validación,
// número de orden → `id` y `refresh()`.

/**
 * Que la orden esté finalizada lo exige `registrarDevolucion`, donde está el
 * `FOR UPDATE`, y no esta puerta.
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
          // Lo que repone no lleva motivo propio, aunque haya viajado uno
          // (escrito y desmarcado): describiría algo que no pasó.
          reason: item.repone ? null : (item.motivo ?? null),
        })),
      }),
    );

    refresh();
    return { returnId };
  });

/**
 * Viaja el `id` de la devolución y no el número de la orden: se anula desde
 * el listado general.
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
