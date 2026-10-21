import "server-only";

import { sql } from "drizzle-orm";

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
 * Van **todas**, también las que no tienen productos: la página las pone al
 * final con «Consultar», en vez de esconderlas como la home.
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
     ORDER BY immutable_unaccent(lower(c.name)), c.id`);

  return filas.map(({ imageKey, ...categoria }) => ({
    ...categoria,
    miniaturaUrl: urlDeLogo(imageKey, "thumb"),
    imagenUrl: urlDeLogo(imageKey, "card"),
  }));
}
