import "server-only";

import { sql } from "drizzle-orm";

import { domainError } from "@/lib/errors";
import { liberar, vender, type Transaccion } from "@/modules/stock/operaciones";

/**
 * Máquina de estados de la orden — FS RF-13, RF-23 · TS §5.6, §8.1. Tarea F4.2.
 *
 * Tres estados y dos salidas, las dos desde `activa`:
 *
 *     crear ──▶ ACTIVA ──┬──▶ FINALIZADA   descuenta el stock y suelta la reserva
 *                        └──▶ CANCELADA    suelta la reserva sin descontar
 *
 * `finalizada` y `cancelada` no van a ningún lado. Una orden finalizada admite
 * devoluciones (RF-25), pero eso no la mueve de estado.
 *
 * **El cambio de estado es la compuerta, y por eso va primero.** Igual que la
 * reserva de §8.2, la transición es un `UPDATE` condicional cuyo `WHERE` lleva
 * el estado esperado. Dos «Finalizar» simultáneos sobre la misma orden dan un
 * ganador y un `INVALID_ORDER_STATE`; el perdedor ni siquiera llega a tocar el
 * stock, porque el `UPDATE` que no encontró fila corta la transacción antes.
 * Con un `SELECT` para chequear el estado y un `UPDATE` después, los dos
 * pasarían el chequeo y el stock se descontaría **dos veces** — y eso no se
 * nota hasta que el inventario no cierra.
 *
 * **El estado se cambia antes de mover el stock, no después.** Es el mismo
 * argumento: lo que decide quién gana tiene que ser lo primero que se ejecuta.
 */

export type EstadoOrden = "activa" | "finalizada" | "cancelada";

/**
 * La tabla de RF-13, como dato y no como una cadena de `if`.
 *
 * Se exporta porque la vista también la necesita: un botón «Finalizar» sobre
 * una orden cancelada no tiene que existir, y averiguarlo repitiendo la regla
 * en el componente es tener dos reglas que un día dicen cosas distintas.
 */
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

/**
 * Los ítems, **ordenados por `variant_id`** — §8.3 regla 2, y no es cosmético.
 *
 * Dos órdenes que comparten productos y los procesan en distinto orden se
 * traban mutuamente: la primera bloquea la variante A y pide la B, la segunda
 * bloqueó la B y pide la A. Postgres mata a una de las dos con un *deadlock*.
 * Recorrer siempre en el mismo orden hace que ese ciclo no pueda formarse.
 */
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

/**
 * El `UPDATE` condicional del estado, más su fila en el historial.
 *
 * Devuelve los ítems ya ordenados, porque quien llama va a moverles el stock y
 * no tiene sentido volver a consultarlos.
 */
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
    // Cero filas no dice si la orden no existe o si ya no está activa, y son
    // dos respuestas distintas para quien las recibe (RNF-08).
    const [actual] = await tx.execute<{ status: EstadoOrden }>(sql`
      SELECT status FROM orders WHERE id = ${args.orderId}`);

    if (!actual) throw domainError("NOT_FOUND");

    throw domainError("INVALID_ORDER_STATE", {
      estadoActual: actual.status,
      intentaba: args.hacia,
    });
  }

  // El historial se escribe en la MISMA transacción que el cambio. Una
  // transición sin fila en el historial es una orden que cambió y no se sabe
  // quién la cambió ni por qué (RF-23).
  await tx.execute(sql`
    INSERT INTO order_status_history
      (order_id, from_status, to_status, reason, actor_user_id)
    VALUES
      (${args.orderId}, 'activa', ${args.hacia},
       ${args.reason ?? null}, ${args.actorUserId ?? null})`);

  return itemsDeLaOrden(tx, args.orderId);
}

// ── Finalizar (RF-23) ───────────────────────────────────────────────────

/**
 * La venta se concretó: descuenta el stock real y suelta la reserva, de una
 * (§8.1). Sólo la administradora.
 */
export async function finalizarOrden(
  tx: Transaccion,
  args: { orderId: string; actorUserId?: string | null; reason?: string | null },
): Promise<void> {
  const items = await transicionar(tx, { ...args, hacia: "finalizada" });

  for (const item of items) {
    // Una variante borrada deja el ítem con `variant_id` en NULL (§5.6): el
    // snapshot de la orden se lee igual, pero ya no hay contador que mover.
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

// ── Cancelar (RF-23) ────────────────────────────────────────────────────

/**
 * No se concretó: suelta la reserva y no toca el stock real. La puede
 * disparar la administradora o el propio comprador desde su panel (RF-07),
 * así que `actorUserId` puede ser cualquiera de los dos — quién tiene permiso
 * lo resuelve la capa de acciones, no esto.
 */
export async function cancelarOrden(
  tx: Transaccion,
  args: { orderId: string; actorUserId?: string | null; reason?: string | null },
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
