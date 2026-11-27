import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { ZERO, type Money } from "@/lib/money";

// Sin RLS, el filtro por `carts.user_id` es la única barrera (§13.8).

export type EstadoDelItem = "vigente" | "sin-stock" | "no-disponible";

export type ItemDelCarrito = {
  variantId: string;
  slug: string;
  nombre: string;
  marca: string;
  colorNombre: string | null;
  /** Para volver a la ficha en el color que se agregó. */
  colorSlug: string | null;
  /** Vigentes (RN-09): el carrito guarda cantidades, nunca precios. */
  precio: Money;
  descuento: Money;
  precioFinal: Money;
  cantidad: number;
  /** `precio final × cantidad`, calculado en la base (§7.1). */
  subtotal: Money;
  /** `stock_total − reserved_stock`. Puede ser negativo (RF-24). */
  disponible: number;
  /** `sin-stock` y `no-disponible` quedan en el carrito, fuera del total. */
  estado: EstadoDelItem;
  /** La primera foto de la variante, o de la que le presta las suyas (§9.5). */
  imagenKey: string | null;
};

export type Carrito = {
  items: ItemDelCarrito[];
  /** Solo suma lo vigente: lo que no se va a poder pedir no entra. */
  total: Money;
  /** Unidades vigentes, no renglones: dos del mismo teclado son dos. */
  unidades: number;
};

/**
 * Una sola consulta, con el total como función de ventana: dos lecturas
 * podrían ver carritos distintos y el total no sería la suma de lo listado.
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
             (coalesce(
               sum(p.final_price * ci.quantity) FILTER (
                 WHERE v.is_active AND p.is_active
                   AND v.stock_total - v.reserved_stock > 0
               ) OVER (),
               0))::numeric(12, 2) AS total,
             (v.stock_total - v.reserved_stock)::int AS disponible,
             CASE
               WHEN NOT (v.is_active AND p.is_active)   THEN 'no-disponible'
               WHEN v.stock_total - v.reserved_stock <= 0 THEN 'sin-stock'
               ELSE 'vigente'
             END AS estado,
             img.storage_key       AS "imagenKey"
        FROM carts c
        JOIN cart_items ci      ON ci.cart_id = c.id
        JOIN product_variants v ON v.id = ci.variant_id
        JOIN products p         ON p.id = v.product_id
        JOIN brands b           ON b.id = p.brand_id
        LEFT JOIN variant_colors co ON co.variant_id = v.id
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
      estado: f.estado,
      imagenKey: f.imagenKey,
    })),
    total: filas[0]?.total ?? ZERO,
    unidades: filas.reduce(
      (n, f) => (f.estado === "vigente" ? n + f.cantidad : n),
      0,
    ),
  };
}

/**
 * Cuenta lo mismo que el resumen del carrito. El `least` no sobra: el
 * encabezado se arma a la vez que la página, y esto puede correr antes de que
 * `revisarCarrito` baje una cantidad al stock que queda.
 */
export async function contarUnidades(userId: string): Promise<number> {
  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT coalesce(
             sum(least(ci.quantity, v.stock_total - v.reserved_stock)),
             0)::int AS n
      FROM cart_items ci
      JOIN carts c            ON c.id = ci.cart_id
      JOIN product_variants v ON v.id = ci.variant_id
      JOIN products p         ON p.id = v.product_id
     WHERE c.user_id = ${userId}
       AND v.is_active AND p.is_active
       AND v.stock_total - v.reserved_stock > 0`);
  return fila.n;
}
