import { sql } from "drizzle-orm";

import { db } from "@/db";

import { unaVariante } from "./catalogo";

/**
 * Órdenes de prueba para F4.
 *
 * **Siempre `origin = 'manual'`**, y no es una preferencia: el CHECK
 * `web_order_has_user` exige `user_id` en toda orden web (§5.6), y un
 * `user_profiles` exige a su vez una fila en `auth.users`. Armar una identidad
 * de Supabase para probar una transición de estado sería traer medio GoTrue a
 * un test de dominio. La máquina de estados no mira el origen.
 *
 * No hace falta limpiar acá: las órdenes se crean contra los productos de
 * `catalogo.ts`, y `limpiar()` borra el producto, que se lleva la orden por
 * `order_items.order_id ON DELETE CASCADE`… salvo la fila de `orders`, que no
 * cuelga de ningún producto. Por eso `limpiarOrdenes()` existe y se llama en
 * el mismo `afterEach`.
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

/**
 * Una orden `activa` con sus ítems, y las variantes ya con la reserva puesta.
 *
 * La reserva se escribe DIRECTO en los contadores, sin pasar por `reservar()`:
 * acá se prepara un escenario, no se prueba una operación. Si el escenario se
 * armara con la función que después se verifica, un fallo de la operación
 * podría esconderse detrás de un escenario que salió igual de mal.
 */
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

/** Atajo para el caso de siempre: una variante, un ítem, todo cuadrado. */
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

/**
 * Las fechas vuelven como TEXTO, no como `Date`: con SQL crudo el driver no
 * sabe qué tipo es cada columna y no las convierte. Da igual para lo que se
 * comprueba —que estén puestas o en nulo—, pero el tipo tiene que decir la
 * verdad o el test afirma algo que no es.
 */
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

/** Los renglones con su id, que es lo que la edición de RF-22 recibe. */
export async function renglonesDeLaOrden(orderId: string): Promise<
  { id: string; variantId: string | null; quantity: number }[]
> {
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

/** El total, tal como quedó guardado en la orden. */
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
 * Se llama desde el mismo `afterEach` que `limpiar()`.
 *
 * Las devoluciones se borran primero: `returns.order_id` es **RESTRICT** a
 * propósito (§5.7) —una orden con devoluciones no se borra—, así que la
 * cascada no las alcanza y el DELETE de la orden falla.
 */
export async function limpiarOrdenes(): Promise<void> {
  for (const id of creadas.splice(0)) {
    await db.execute(sql`DELETE FROM returns WHERE order_id = ${id}`);
    await db.execute(sql`DELETE FROM orders WHERE id = ${id}`);
  }
}
