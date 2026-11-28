import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import type { ProductoEnTarjeta } from "@/components/shop/tarjeta-producto";
import { POR_PAGINA } from "@/modules/catalog/products/filtros-tienda";
import {
  aTarjeta,
  COLUMNAS_DE_TARJETA,
  UNIONES_DE_TARJETA,
  type FilaDeTarjeta,
} from "@/modules/catalog/products/tienda";

// Todas filtran por `favorites.user_id` con el id de la sesión.

/**
 * Todos y no solo los de la página, para correr en paralelo con el catálogo.
 * Con `cache()`: dos componentes de la ficha la piden en el mismo pedido.
 */
export const idsDeFavoritos = cache(async function idsDeFavoritos(
  userId: string,
): Promise<string[]> {
  const filas = await db.execute<{ productId: string }>(sql`
    SELECT product_id AS "productId" FROM favorites WHERE user_id = ${userId}`);
  return filas.map((f) => f.productId);
});

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
  /** `false`: «No disponible» y sin enlace, la ficha sería un 404. */
  activo: boolean;
};

/**
 * El conteo va aparte y no como función de ventana: con una página pasada del
 * final, la ventana no devolvería ninguna fila de donde leerlo.
 */
export async function leerFavoritos(
  userId: string,
  {
    pagina = 1,
    porPagina = POR_PAGINA,
  }: { pagina?: number; porPagina?: number } = {},
): Promise<{ favoritos: Favorito[]; total: number }> {
  const [filas, [conteo]] = await Promise.all([
    db.execute<FilaDeTarjeta & { activo: boolean }>(sql`
      SELECT ${COLUMNAS_DE_TARJETA},
             p.is_active AS activo
        FROM favorites f
        JOIN products p ON p.id = f.product_id
        JOIN brands b   ON b.id = p.brand_id
        ${UNIONES_DE_TARJETA}
       WHERE f.user_id = ${userId}
       ORDER BY f.created_at DESC, p.id
       LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`),

    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM favorites WHERE user_id = ${userId}`),
  ]);

  return {
    favoritos: filas.map((f) => ({ ...aTarjeta(f), activo: f.activo })),
    total: conteo.n,
  };
}
