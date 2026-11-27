"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import {
  agregarItem,
  aumentarCantidad,
  quitarItem,
  reducirCantidad,
} from "@/modules/orders/editar";
import { cancelarOrden, finalizarOrden } from "@/modules/orders/estados";
import { idDeLaOrden } from "@/modules/orders/queries-panel";
import {
  cancelacionDelPanel,
  laOrdenDelPanel,
} from "@/modules/orders/schemas-panel";

const laOrden = z.object({
  numero: z.number().int().positive(),
  /** El renglón, no la variante: una orden puede repetir producto y color. */
  itemId: z.uuid(),
});

async function idDeLaOrdenO404(numero: number): Promise<string> {
  const orderId = await idDeLaOrden(numero);
  if (!orderId) throw domainError("NOT_FOUND");
  return orderId;
}

/**
 * `cancelarSiEsElUltimo` autoriza cancelar la orden si el renglón es el único
 * (RF-22). Lo decide el dominio y no la pantalla: otra pestaña pudo haber
 * quitado los demás renglones entre que se pintó y llegó el clic.
 */
export const quitarItemDeLaOrden = action
  // Opcional y no `default(false)`: con `default` el tipo de entrada exigiría
  // el campo. No mandarlo es no autorizar la cancelación.
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

/** Sólo baja; que la cantidad sea menor lo valida el dominio contra la base. */
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
 * La cancelación de la vendedora; el arrepentimiento del comprador es
 * `cancelarMiOrden`. El motivo lo ve el comprador en el detalle de su compra.
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
        // Vacío es `null`: un `reason = ''` se leería como «hay motivo».
        reason: input.motivo || null,
      }),
    );

    refresh();
    return { numero: input.numero };
  });

/** Puede volver con `INSUFFICIENT_STOCK`, con un mensaje que dice cuántas quedan. */
export const aumentarCantidadDelItem = action
  .input(laOrden.extend({ cantidad: z.number().int().min(1).max(9999) }))
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeLaOrdenO404(input.numero);

    await db.transaction((tx) =>
      aumentarCantidad(tx, {
        orderId,
        orderItemId: input.itemId,
        nuevaCantidad: input.cantidad,
        actorUserId: ctx.session.profile.id,
      }),
    );

    refresh();
    return { cantidad: input.cantidad };
  });

/** Viaja la variante: si ya está en la orden, el dominio suma sobre su renglón. */
export const agregarItemALaOrden = action
  .input(
    z.object({
      numero: z.number().int().positive(),
      variantId: z.uuid(),
      cantidad: z.number().int().min(1).max(9999),
    }),
  )
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orderId = await idDeLaOrdenO404(input.numero);

    const resultado = await db.transaction((tx) =>
      agregarItem(tx, {
        orderId,
        variantId: input.variantId,
        cantidad: input.cantidad,
        actorUserId: ctx.session.profile.id,
      }),
    );

    refresh();
    return resultado;
  });
