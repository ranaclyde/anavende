import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { ZERO, type Money } from "@/lib/money";

/**
 * Lecturas del carrito — RF-08 · TS §5.5, §7.1, §13.8. Tarea F5.5.
 *
 * Las dos filtran por `carts.user_id` con el id de la sesión, y por el mismo
 * motivo que las operaciones: sin RLS no hay otra barrera (§13.8).
 */

export type ItemDelCarrito = {
  variantId: string;
  slug: string;
  nombre: string;
  marca: string;
  colorNombre: string | null;
  /** Para volver a la ficha en el color que se agregó. */
  colorSlug: string | null;
  /**
   * Los tres precios VIGENTES (RN-09): el carrito guarda cantidades, nunca
   * precios (§5.5). Si la vendedora cambia un precio, el carrito lo muestra
   * cambiado; avisarlo es F5.6.
   */
  precio: Money;
  descuento: Money;
  precioFinal: Money;
  cantidad: number;
  /** `precio final × cantidad`, calculado en la base (§7.1). */
  subtotal: Money;
  /** `stock_total − reserved_stock`. Puede ser negativo (RF-24). */
  disponible: number;
  /** `false` si el producto o la variante se desactivaron: es F5.6. */
  seVende: boolean;
  /** La primera foto de la variante, o de la que le presta las suyas (§9.5). */
  imagenKey: string | null;
};

export type Carrito = {
  items: ItemDelCarrito[];
  /** Suma de los subtotales, también en la base. */
  total: Money;
  /** Unidades, no renglones: dos del mismo teclado son dos. */
  unidades: number;
};

/**
 * El carrito entero, con los subtotales y el total calculados en SQL.
 *
 * **Una sola consulta y no dos**: el total va como función de ventana sobre
 * las mismas filas. Con una consulta aparte serían dos lecturas que pueden
 * ver dos carritos distintos si en el medio se cambia una cantidad, y la
 * pantalla mostraría un total que no es la suma de lo que lista.
 *
 * El orden es el de llegada: lo último que se agregó queda abajo, que es
 * donde se lo busca después de agregarlo.
 */
export async function leerCarrito(userId: string): Promise<Carrito> {
  const filas = [
    ...(await db.execute<ItemDelCarrito & { total: Money }>(sql`
      SELECT ci.variant_id         AS "variantId",
             p.slug,
             p.name                AS nombre,
             b.name                AS marca,
             co.name               AS "colorNombre",
             co.slug               AS "colorSlug",
             p.price               AS precio,
             p.discount            AS descuento,
             p.final_price         AS "precioFinal",
             ci.quantity           AS cantidad,
             (p.final_price * ci.quantity)::numeric(12, 2) AS subtotal,
             (sum(p.final_price * ci.quantity) OVER ())::numeric(12, 2) AS total,
             (v.stock_total - v.reserved_stock)::int AS disponible,
             (v.is_active AND p.is_active) AS "seVende",
             img.storage_key       AS "imagenKey"
        FROM carts c
        JOIN cart_items ci      ON ci.cart_id = c.id
        JOIN product_variants v ON v.id = ci.variant_id
        JOIN products p         ON p.id = v.product_id
        JOIN brands b           ON b.id = p.brand_id
        LEFT JOIN colors co     ON co.id = v.color_id
        LEFT JOIN LATERAL (
          SELECT i.storage_key
            FROM variant_images i
           WHERE i.variant_id = coalesce(v.images_source_id, v.id)
           ORDER BY i.sort_order
           LIMIT 1
        ) img ON true
       WHERE c.user_id = ${userId}
       ORDER BY ci.added_at, ci.id`)),
  ];

  return {
    items: filas.map((f) => ({
      variantId: f.variantId,
      slug: f.slug,
      nombre: f.nombre,
      marca: f.marca,
      colorNombre: f.colorNombre,
      colorSlug: f.colorSlug,
      precio: f.precio,
      descuento: f.descuento,
      precioFinal: f.precioFinal,
      cantidad: f.cantidad,
      subtotal: f.subtotal,
      disponible: f.disponible,
      seVende: f.seVende,
      imagenKey: f.imagenKey,
    })),
    total: filas[0]?.total ?? ZERO,
    unidades: filas.reduce((n, f) => n + f.cantidad, 0),
  };
}

/** Las unidades del carrito, para la píldora del encabezado (§5.1). */
export async function contarUnidades(userId: string): Promise<number> {
  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT coalesce(sum(ci.quantity), 0)::int AS n
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
     WHERE c.user_id = ${userId}`);
  return fila.n;
}
