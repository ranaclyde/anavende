import "server-only";

import { sql } from "drizzle-orm";

import { domainError } from "@/lib/errors";
import { liberar, vender, type Transaccion } from "@/modules/stock/operaciones";

/**
 * Máquina de estados de la orden (RF-13, RF-23): `activa` pasa a `finalizada`
 * o a `cancelada`, y de ahí no sale.
 *
 * La transición es un `UPDATE` condicional sobre el estado y va antes de mover
 * el stock: de dos «Finalizar» simultáneos gana uno y el otro corta antes de
 * tocar el stock. Con `SELECT` + `UPDATE` los dos pasarían y se descontaría dos veces.
 */

export type EstadoOrden = "activa" | "finalizada" | "cancelada";

/** Se exporta para que la vista decida qué botones mostrar sin repetir la regla. */
export const TRANSICIONES: Record<EstadoOrden, readonly EstadoOrden[]> = {
  activa: ["finalizada", "cancelada"],
  finalizada: [],
  cancelada: [],
};

export function transicionPermitida(
  desde: EstadoOrden,
  hacia: EstadoOrden,
): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

type ItemDeOrden = {
  variantId: string | null;
  quantity: number;
};

/** Ordenados por `variant_id` para evitar *deadlocks* (TECHNICAL-SPEC §8.3). */
async function itemsDeLaOrden(
  tx: Transaccion,
  orderId: string,
): Promise<ItemDeOrden[]> {
  return [
    ...(await tx.execute<ItemDeOrden>(sql`
      SELECT variant_id AS "variantId", quantity
        FROM order_items
       WHERE order_id = ${orderId}
       ORDER BY variant_id`)),
  ];
}

/** Cambia el estado y escribe el historial; devuelve los ítems ya ordenados. */
async function transicionar(
  tx: Transaccion,
  args: {
    orderId: string;
    hacia: Exclude<EstadoOrden, "activa">;
    actorUserId?: string | null;
    reason?: string | null;
  },
): Promise<ItemDeOrden[]> {
  const marcaDeTiempo =
    args.hacia === "finalizada"
      ? sql`finalized_at = now()`
      : sql`cancelled_at = now()`;

  const filas = await tx.execute<{ desde: EstadoOrden }>(sql`
    UPDATE orders
       SET status = ${args.hacia},
           ${marcaDeTiempo},
           updated_at = now()
     WHERE id = ${args.orderId}
       AND status = 'activa'
    RETURNING 'activa'::text AS desde`);

  if (filas.length === 0) {
    // Cero filas no distingue «no existe» de «ya no está activa».
    const [actual] = await tx.execute<{ status: EstadoOrden }>(sql`
      SELECT status FROM orders WHERE id = ${args.orderId}`);

    if (!actual) throw domainError("NOT_FOUND");

    throw domainError("INVALID_ORDER_STATE", {
      estadoActual: actual.status,
      intentaba: args.hacia,
    });
  }

  await tx.execute(sql`
    INSERT INTO order_status_history
      (order_id, from_status, to_status, reason, actor_user_id)
    VALUES
      (${args.orderId}, 'activa', ${args.hacia},
       ${args.reason ?? null}, ${args.actorUserId ?? null})`);

  return itemsDeLaOrden(tx, args.orderId);
}

/** Descuenta el stock real y suelta la reserva. Sólo la administradora. */
export async function finalizarOrden(
  tx: Transaccion,
  args: {
    orderId: string;
    actorUserId?: string | null;
    reason?: string | null;
  },
): Promise<void> {
  const items = await transicionar(tx, { ...args, hacia: "finalizada" });

  for (const item of items) {
    // Variante borrada: el ítem queda con `variant_id` NULL y no hay contador.
    if (!item.variantId) continue;

    await vender(tx, {
      variantId: item.variantId,
      quantity: item.quantity,
      orderId: args.orderId,
      actorUserId: args.actorUserId,
      note: "Orden finalizada",
    });
  }
}

/**
 * Suelta la reserva sin tocar el stock real. La dispara la administradora o el
 * comprador (RF-07); el permiso lo resuelve la capa de acciones.
 */
export async function cancelarOrden(
  tx: Transaccion,
  args: {
    orderId: string;
    actorUserId?: string | null;
    reason?: string | null;
  },
): Promise<void> {
  const items = await transicionar(tx, { ...args, hacia: "cancelada" });

  for (const item of items) {
    if (!item.variantId) continue;

    await liberar(tx, {
      variantId: item.variantId,
      quantity: item.quantity,
      orderId: args.orderId,
      actorUserId: args.actorUserId,
      note: "Orden cancelada",
    });
  }
}
