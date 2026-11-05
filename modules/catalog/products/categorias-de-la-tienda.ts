import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import type { CategoriaDeLaPagina } from "@/modules/catalog/products/categorias";
import { urlDeLogo } from "@/modules/media/subir";

/**
 * Todas las categorías activas con su cantidad de productos — RF-35, DR §7.6.
 * Tarea F3.10.
 *
 * **Una consulta y no dos**: la cantidad sale de una subconsulta por fila, que
 * con decenas de categorías y el índice de `products.category_id` no pesa, y
 * evita un segundo viaje para juntar los conteos a mano.
 *
 * **La cantidad cuenta los productos activos con o sin stock**, porque es lo
 * que el catálogo muestra al filtrar por esa categoría (RN-05): un «3
 * productos» que lleva a una grilla de cinco sería una promesa rota.
 *
 * **Sólo las que tienen algún producto activo**, como «Más categorías» de la
 * home: una categoría vacía nombrada en la página es un enlace a un «no hay
 * nada» (2026-10-21, pedido tuyo; se probó mostrarlas al final con una
 * consulta por WhatsApp y rompían la lista).
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

/** Lo que la página de una categoría dice de ella — F3.11. */
export type CategoriaConPagina = {
  slug: string;
  nombre: string;
  /** El texto que escribió la vendedora; `null` si no escribió nada. */
  texto: string | null;
};

/**
 * La categoría de `/categorias/[slug]`, o `null` si no tiene página.
 *
 * **Solo las activas**: una desactivada da 404, igual que un producto
 * desactivado (RN-05). Una activa sin productos sí tiene página —con el vacío
 * de «todavía no hay productos»—, porque el enlace pudo haberse compartido
 * antes de que se vendiera el último.
 *
 * Con `cache` de React: la piden `generateMetadata` y la página en el mismo
 * pedido, y sin esto serían dos viajes a la base por la misma fila.
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
