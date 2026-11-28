import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import type { CategoriaDeLaPagina } from "@/modules/catalog/products/categorias";
import { urlDeLogo } from "@/modules/media/subir";

/**
 * Solo las que tienen algún producto activo. La cantidad cuenta activos con o
 * sin stock, que es lo que muestra el catálogo al filtrar (RN-05).
 */
export async function leerCategoriasDeLaTienda(): Promise<
  CategoriaDeLaPagina[]
> {
  const filas = await db.execute<{
    id: string;
    slug: string;
    nombre: string;
    cantidad: number;
    destacada: boolean;
    imageKey: string | null;
  }>(sql`
    SELECT c.id,
           c.slug,
           c.name        AS nombre,
           c.is_featured AS destacada,
           c.image_key   AS "imageKey",
           (SELECT count(*)::int
              FROM products p
             WHERE p.category_id = c.id AND p.is_active) AS cantidad
      FROM categories c
     WHERE c.is_active
       AND EXISTS (SELECT 1 FROM products p
                    WHERE p.category_id = c.id AND p.is_active)
     ORDER BY immutable_unaccent(lower(c.name)), c.id`);

  return filas.map(({ imageKey, ...categoria }) => ({
    ...categoria,
    miniaturaUrl: urlDeLogo(imageKey, "thumb"),
    imagenUrl: urlDeLogo(imageKey, "card"),
  }));
}

export type CategoriaConPagina = {
  slug: string;
  nombre: string;
  /** El texto que escribió la vendedora; `null` si no escribió nada. */
  texto: string | null;
};

/**
 * `null` si está inactiva. Una activa sin productos sí tiene página: el enlace
 * pudo haberse compartido antes. Con `cache` porque la piden `generateMetadata`
 * y la página en el mismo pedido.
 */
export const leerCategoriaConPagina = cache(
  async (slug: string): Promise<CategoriaConPagina | null> => {
    const [fila] = await db.execute<CategoriaConPagina>(sql`
      SELECT slug, name AS nombre, description AS texto
        FROM categories
       WHERE slug = ${slug} AND is_active
       LIMIT 1`);
    return fila ?? null;
  },
);
