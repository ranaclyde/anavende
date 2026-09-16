import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { POR_PAGINA } from "@/modules/catalog/products/filtros-tienda";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import type { Money } from "@/lib/money";
import type { EstadoOrden } from "@/modules/orders/estados";

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

/**
 * Quién canceló el pedido, y por qué si lo dijo — RF-23. Tarea F7.3.
 *
 * **Hasta F7.3 esto no hacía falta**, porque el único que podía cancelar era
 * el propio comprador: la pantalla decía «Cancelaste este pedido» y siempre
 * era verdad. Desde que la vendedora también puede (RF-23), decirlo así sería
 * contarle a alguien que él canceló lo que le cancelaron.
 *
 * **`porLaTienda` sale de comparar el autor con el dueño de la orden**, no
 * del rol de quien la movió, por lo mismo que en el panel: el rol es el de
 * hoy y el dueño de la orden no cambia (F7.1). Un autor en blanco cuenta
 * como la tienda — el comprador siempre queda registrado al cancelar.
 */
export type CancelacionDeLaOrden = {
  porLaTienda: boolean;
  /** Sólo el que escribe la vendedora: al arrepentimiento no se le pide (RF-23). */
  motivo: string | null;
};

export type OrdenDelComprador = {
  numero: number;
  estado: EstadoOrden;
  /** ISO, como la devuelve el driver con SQL crudo: acá no se opera con ella. */
  creadaEn: string;
  total: Money;
  unidades: number;
  /**
   * El del pedido, no el de la cuenta: F6.1 decidió que el nombre y el
   * teléfono del checkout valen sólo para esa orden.
   */
  customerName: string;
  items: ItemDeLaOrden[];
  shippingAddress: ShippingAddressSnapshot | null;
  /** `null` mientras no esté cancelada, que es el caso de siempre. */
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

  // Se suma acá y no con una segunda subconsulta sobre `order_items`: los
  // renglones ya vinieron, y dos lecturas de la misma tabla pueden discrepar
  // el día que una cambie y la otra no.
  const unidades = fila.items.reduce((suma, item) => suma + item.cantidad, 0);
  return { ...fila, unidades };
}

// ── «Mis compras» (RF-07, F6.5) ─────────────────────────────────────────

/**
 * Un renglón del historial.
 *
 * **Lleva `resumen` y no los ítems enteros**: el listado tiene que dejar
 * reconocer cuál es cuál —«Auricular Cloud II y 1 más»—, y traer todos los
 * renglones de todas las órdenes para mostrar el primero sería leer de más en
 * cada carga. El detalle los trae completos.
 */
export type CompraDelHistorial = {
  numero: number;
  estado: EstadoOrden;
  creadaEn: string;
  total: Money;
  unidades: number;
  /** El nombre del primer producto, con cuántos más hay. */
  resumen: string;
};

/**
 * El historial del comprador, de la más nueva a la más vieja — RF-07.
 *
 * **Paginado con el mismo tope que el catálogo y los favoritos.** No hay
 * límite de compras y una cuenta vieja cargaría todas de una; un segundo
 * número de página en el proyecto sería una constante más para mantener sin
 * nada que la justifique.
 */
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

/**
 * El `id` de una orden del comprador, para las acciones que la cambian.
 *
 * **Devuelve `null` para la orden de otro, igual que si no existiera**
 * (§13.8): quien cancela llega con un número de la URL, y ese número es
 * adivinable.
 */
export async function idDeMiOrden(
  userId: string,
  numero: number,
): Promise<string | null> {
  const [fila] = await db.execute<{ id: string }>(sql`
    SELECT id FROM orders
     WHERE order_number = ${numero} AND user_id = ${userId}`);
  return fila?.id ?? null;
}
