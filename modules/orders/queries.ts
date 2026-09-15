import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import type { Money } from "@/lib/money";

/**
 * Lecturas de órdenes del lado del comprador — FS RF-12 · TS §13.8.
 *
 * Todas filtran por `user_id` con el id de la sesión: sin RLS es la única
 * barrera (§13.8). Una orden ajena responde igual que una que no existe.
 */

export type OrdenDelComprador = {
  numero: number;
  total: Money;
  unidades: number;
  shippingAddress: ShippingAddressSnapshot | null;
};

export async function leerOrdenDelComprador(
  userId: string,
  numero: number,
): Promise<OrdenDelComprador | null> {
  const [fila] = await db.execute<OrdenDelComprador>(sql`
    SELECT o.order_number     AS numero,
           o.total,
           (SELECT coalesce(sum(i.quantity), 0)::int
              FROM order_items i WHERE i.order_id = o.id) AS unidades,
           o.shipping_address AS "shippingAddress"
      FROM orders o
     WHERE o.order_number = ${numero}
       AND o.user_id = ${userId}`);
  return fila ?? null;
}
