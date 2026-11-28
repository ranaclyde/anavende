import { sql } from "drizzle-orm";

import { db } from "@/db";

import { unaVariante } from "./catalogo";

/**
 * Siempre `origin = 'manual'`: una orden web exige usuario (CHECK
 * `web_order_has_user`), y la máquina de estados no mira el origen.
 */

const creadas: string[] = [];

export type ItemPedido = {
  variantId: string;
  quantity: number;
  unitPrice?: string;
};

export type OrdenPrueba = {
  orderId: string;
  items: ItemPedido[];
};

/** No toca los contadores: la reserva se arma antes, con `unaVariante`. */
export async function unaOrdenActiva(
  items: readonly ItemPedido[],
): Promise<OrdenPrueba> {
  const [orden] = await db.execute<{ id: string }>(sql`
    INSERT INTO orders (origin, status, customer_name, customer_phone)
    VALUES ('manual', 'activa', 'Cliente de prueba', '+5491100000000')
    RETURNING id`);
  creadas.push(orden.id);

  for (const item of items) {
    await db.execute(sql`
      INSERT INTO order_items
        (order_id, variant_id, product_name, brand_name, unit_price, quantity)
      VALUES
        (${orden.id}, ${item.variantId}, 'Producto de prueba', 'Marca de prueba',
         ${item.unitPrice ?? "1000.00"}, ${item.quantity})`);
  }

  await db.execute(sql`
    INSERT INTO order_status_history (order_id, from_status, to_status)
    VALUES (${orden.id}, NULL, 'activa')`);

  return { orderId: orden.id, items: [...items] };
}

export async function unaOrdenDeUnItem(stock: {
  total: number;
  cantidad: number;
}): Promise<{ orderId: string; variantId: string }> {
  const { variantId } = await unaVariante({
    total: stock.total,
    reservado: stock.cantidad,
  });
  const { orderId } = await unaOrdenActiva([
    { variantId, quantity: stock.cantidad },
  ]);
  return { orderId, variantId };
}

/** Las fechas vuelven como texto: con SQL crudo el driver no las convierte. */
export async function estadoDeLaOrden(orderId: string): Promise<{
  status: string;
  finalizedAt: string | null;
  cancelledAt: string | null;
}> {
  const [fila] = await db.execute<{
    status: string;
    finalizedAt: string | null;
    cancelledAt: string | null;
  }>(sql`
    SELECT status,
           finalized_at AS "finalizedAt",
           cancelled_at AS "cancelledAt"
      FROM orders WHERE id = ${orderId}`);
  return fila;
}

export async function renglonesDeLaOrden(
  orderId: string,
): Promise<{ id: string; variantId: string | null; quantity: number }[]> {
  return [
    ...(await db.execute<{
      id: string;
      variantId: string | null;
      quantity: number;
    }>(sql`
      SELECT id, variant_id AS "variantId", quantity
        FROM order_items
       WHERE order_id = ${orderId}
       ORDER BY created_at, id`)),
  ];
}

export async function totalDeLaOrden(orderId: string): Promise<string> {
  const [fila] = await db.execute<{ total: string }>(sql`
    SELECT total FROM orders WHERE id = ${orderId}`);
  return fila.total;
}

export type EntradaDeHistorial = {
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorUserId: string | null;
};

export async function historial(
  orderId: string,
): Promise<EntradaDeHistorial[]> {
  return [
    ...(await db.execute<EntradaDeHistorial>(sql`
      SELECT from_status    AS "fromStatus",
             to_status      AS "toStatus",
             reason,
             actor_user_id  AS "actorUserId"
        FROM order_status_history
       WHERE order_id = ${orderId}
       ORDER BY created_at, id`)),
  ];
}

/**
 * Borrar el producto no se lleva la fila de `orders`. Las devoluciones van
 * primero: `returns.order_id` es RESTRICT (§5.7).
 */
export async function limpiarOrdenes(): Promise<void> {
  for (const id of creadas.splice(0)) {
    await db.execute(sql`DELETE FROM returns WHERE order_id = ${id}`);
    await db.execute(sql`DELETE FROM orders WHERE id = ${id}`);
  }
}
