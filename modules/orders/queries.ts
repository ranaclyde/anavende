import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { POR_PAGINA } from "@/modules/catalog/products/filtros-tienda";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import type { Money } from "@/lib/money";
import type { EstadoOrden } from "@/modules/orders/estados";

/**
 * Lado del comprador: todas filtran por `user_id` de la sesión, que sin RLS es
 * la única barrera (§13.8). Una orden ajena responde igual que una inexistente.
 */

/** El snapshot de `order_items` (RN-12), no el producto vivo: por eso no hay foto. */
export type ItemDeLaOrden = {
  id: string;
  nombre: string;
  marca: string;
  color: string | null;
  cantidad: number;
  precioUnitario: Money;
  subtotal: Money;
};

/**
 * `porLaTienda` compara el autor con el dueño de la orden, no el rol. Un autor
 * en blanco cuenta como la tienda: el comprador siempre queda registrado.
 */
export type CancelacionDeLaOrden = {
  porLaTienda: boolean;
  /** Sólo el que escribe la vendedora. */
  motivo: string | null;
};

export type OrdenDelComprador = {
  numero: number;
  estado: EstadoOrden;
  /** ISO, como la devuelve el driver con SQL crudo. */
  creadaEn: string;
  total: Money;
  unidades: number;
  /** El del pedido, no el de la cuenta. */
  customerName: string;
  items: ItemDeLaOrden[];
  shippingAddress: ShippingAddressSnapshot | null;
  /** `null` mientras no esté cancelada. */
  cancelacion: CancelacionDeLaOrden | null;
};

export async function leerOrdenDelComprador(
  userId: string,
  numero: number,
): Promise<OrdenDelComprador | null> {
  const [fila] = await db.execute<Omit<OrdenDelComprador, "unidades">>(sql`
    SELECT o.order_number     AS numero,
           o.status           AS estado,
           o.created_at       AS "creadaEn",
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
              FROM order_items i WHERE i.order_id = o.id) AS items,
           -- La última cancelación de esta orden, que es también la única:
           -- de cancelada no se sale (RF-13). El orden está igual, porque una
           -- consulta que depende de que haya una sola fila se rompe sola el
           -- día que eso deje de ser cierto.
           CASE WHEN o.status = 'cancelada' THEN (
             SELECT json_build_object(
                      'porLaTienda', h.actor_user_id IS DISTINCT FROM o.user_id,
                      'motivo',      h.reason)
               FROM order_status_history h
              WHERE h.order_id = o.id
                AND h.to_status = 'cancelada'
              ORDER BY h.created_at DESC, h.id DESC
              LIMIT 1
           ) END AS cancelacion
      FROM orders o
     WHERE o.order_number = ${numero}
       AND o.user_id = ${userId}`);

  if (!fila) return null;

  const unidades = fila.items.reduce((suma, item) => suma + item.cantidad, 0);
  return { ...fila, unidades };
}

export type CompraDelHistorial = {
  numero: number;
  estado: EstadoOrden;
  creadaEn: string;
  total: Money;
  unidades: number;
  /** «Auricular Cloud II y 1 más». */
  resumen: string;
};

export async function leerMisCompras(
  userId: string,
  {
    pagina = 1,
    porPagina = POR_PAGINA,
  }: { pagina?: number; porPagina?: number } = {},
): Promise<{ compras: CompraDelHistorial[]; total: number }> {
  const [filas, [conteo]] = await Promise.all([
    db.execute<CompraDelHistorial>(sql`
      SELECT o.order_number AS numero,
             o.status       AS estado,
             o.created_at   AS "creadaEn",
             o.total,
             (SELECT coalesce(sum(i.quantity), 0)::int
                FROM order_items i WHERE i.order_id = o.id) AS unidades,
             (SELECT CASE
                       WHEN count(*) <= 1 THEN min(i.product_name)
                       ELSE min(i.product_name) || ' y ' ||
                            (count(*) - 1)::text || ' más'
                     END
                FROM order_items i WHERE i.order_id = o.id) AS resumen
        FROM orders o
       WHERE o.user_id = ${userId}
       ORDER BY o.created_at DESC, o.order_number DESC
       LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`),
    db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM orders WHERE user_id = ${userId}`),
  ]);

  return { compras: [...filas], total: conteo.total };
}

/** `null` para la orden de otro, igual que si no existiera: el número es adivinable. */
export async function idDeMiOrden(
  userId: string,
  numero: number,
): Promise<string | null> {
  const [fila] = await db.execute<{ id: string }>(sql`
    SELECT id FROM orders
     WHERE order_number = ${numero} AND user_id = ${userId}`);
  return fila?.id ?? null;
}
