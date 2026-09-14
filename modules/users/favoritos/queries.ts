import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ProductoEnTarjeta } from "@/components/shop/tarjeta-producto";
import {
  aTarjeta,
  COLUMNAS_DE_TARJETA,
  UNIONES_DE_TARJETA,
  type FilaDeTarjeta,
} from "@/modules/catalog/products/tienda";

/**
 * Lecturas de favoritos — RF-10 · TS §5.5, §13.8. Tarea F5.4.
 *
 * Todas filtran por `favorites.user_id` con el id de la sesión.
 */

/**
 * Los productos guardados, para pintar los corazones del catálogo.
 *
 * Todos y no solo los de la página que se está mirando: son los que la
 * persona fue guardando a mano, así que la lista es corta, y filtrarla por
 * los ids de la página obligaría a esperar esa consulta para lanzar esta.
 * Así corren en paralelo.
 */
export async function idsDeFavoritos(userId: string): Promise<string[]> {
  const filas = await db.execute<{ productId: string }>(sql`
    SELECT product_id AS "productId" FROM favorites WHERE user_id = ${userId}`);
  return filas.map((f) => f.productId);
}

export async function esFavorito(
  userId: string,
  productId: string,
): Promise<boolean> {
  const [fila] = await db.execute<{ es: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM favorites
       WHERE user_id = ${userId} AND product_id = ${productId}
    ) AS es`);
  return fila.es;
}

export type Favorito = ProductoEnTarjeta & {
  /**
   * `false` si la vendedora lo desactivó después de que se guardara. Se
   * queda en la lista como «No disponible» (RF-10), sin enlace: la ficha de
   * un producto inactivo es un 404 (RN-05).
   */
  activo: boolean;
};

/**
 * La lista de «Favoritos», con la misma tarjeta que el catálogo: precio y
 * stock VIGENTES, porque se leen del producto en el momento (RF-10). El
 * último guardado va primero, que es el que se viene a buscar.
 */
export async function leerFavoritos(userId: string): Promise<Favorito[]> {
  const filas = await db.execute<FilaDeTarjeta & { activo: boolean }>(sql`
    SELECT ${COLUMNAS_DE_TARJETA},
           p.is_active AS activo
      FROM favorites f
      JOIN products p ON p.id = f.product_id
      JOIN brands b   ON b.id = p.brand_id
      ${UNIONES_DE_TARJETA}
     WHERE f.user_id = ${userId}
     ORDER BY f.created_at DESC, p.id`);

  return filas.map((f) => ({ ...aTarjeta(f), activo: f.activo }));
}
