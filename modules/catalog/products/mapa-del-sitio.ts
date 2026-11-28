import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// Lo que va en `sitemap.xml`. Un producto sin variantes también entra: su
// ficha existe (RN-05).

/** El tope del protocolo por archivo. Si se supera, hay que partirlo con `generateSitemaps`. */
export const TOPE_DEL_MAPA = 50_000;

export type ProductoDelMapa = {
  slug: string;
  /**
   * Ya formateada por Postgres: una consulta cruda devuelve `timestamptz` con
   * espacio y sin `T`, Next lo escribe tal cual y los buscadores lo descartan.
   */
  actualizado: string;
};

export async function productosDelMapa(): Promise<ProductoDelMapa[]> {
  const filas = await db.execute<ProductoDelMapa>(sql`
    SELECT slug,
           to_char(updated_at AT TIME ZONE 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS actualizado
      FROM products
     WHERE is_active
     ORDER BY updated_at DESC
     LIMIT ${TOPE_DEL_MAPA}
  `);

  return [...filas];
}

/** Solo las activas con algún producto activo; la fecha es la del producto más reciente. */
export type CategoriaDelMapa = { slug: string; actualizado: string };

export async function categoriasDelMapa(): Promise<CategoriaDelMapa[]> {
  const filas = await db.execute<CategoriaDelMapa>(sql`
    SELECT c.slug,
           to_char(max(p.updated_at) AT TIME ZONE 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS actualizado
      FROM categories c
      JOIN products p ON p.category_id = c.id AND p.is_active
     WHERE c.is_active
     GROUP BY c.id
     ORDER BY c.slug
  `);

  return [...filas];
}
