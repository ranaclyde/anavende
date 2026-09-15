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

/**
 * Un renglón de la orden, como quedó congelado al crearse (RN-12).
 *
 * **Sale de `order_items` y no de los productos vivos.** El nombre, la marca,
 * el color y el precio son los del momento de la compra: el producto pudo
 * cambiar de precio, de nombre o dejar de venderse, y el comprobante tiene
 * que seguir diciendo lo que se compró. Por eso tampoco hay foto: el snapshot
 * no guarda la imagen, y traerla del producto de hoy sería mezclar las dos
 * cosas.
 */
export type ItemDeLaOrden = {
  id: string;
  nombre: string;
  marca: string;
  color: string | null;
  cantidad: number;
  precioUnitario: Money;
  subtotal: Money;
};

export type OrdenDelComprador = {
  numero: number;
  total: Money;
  unidades: number;
  /**
   * El del pedido, no el de la cuenta: F6.1 decidió que el nombre y el
   * teléfono del checkout valen sólo para esa orden.
   */
  customerName: string;
  items: ItemDeLaOrden[];
  shippingAddress: ShippingAddressSnapshot | null;
};

export async function leerOrdenDelComprador(
  userId: string,
  numero: number,
): Promise<OrdenDelComprador | null> {
  const [fila] = await db.execute<Omit<OrdenDelComprador, "unidades">>(sql`
    SELECT o.order_number     AS numero,
           o.total,
           o.customer_name    AS "customerName",
           o.shipping_address AS "shippingAddress",
           (SELECT coalesce(
                     json_agg(
                       json_build_object(
                         'id',             i.id,
                         'nombre',         i.product_name,
                         'marca',          i.brand_name,
                         'color',          i.color_name,
                         'cantidad',       i.quantity,
                         'precioUnitario', i.unit_price::text,
                         'subtotal',       i.subtotal::text
                       )
                       ORDER BY i.product_name, i.color_name
                     ),
                     '[]'::json)
              FROM order_items i WHERE i.order_id = o.id) AS items
      FROM orders o
     WHERE o.order_number = ${numero}
       AND o.user_id = ${userId}`);

  if (!fila) return null;

  // Se suma acá y no con una segunda subconsulta sobre `order_items`: los
  // renglones ya vinieron, y dos lecturas de la misma tabla pueden discrepar
  // el día que una cambie y la otra no.
  const unidades = fila.items.reduce((suma, item) => suma + item.cantidad, 0);
  return { ...fila, unidades };
}
