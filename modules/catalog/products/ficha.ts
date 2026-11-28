import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import type { Money } from "@/lib/money";
import { rutaDeVistaPrevia, urlDeImagen } from "@/modules/media/subir";

// Una sola consulta con variantes e imágenes adentro, para no encadenar tres
// viajes. No filtra por marca o categoría activas: RN-11b lo sostiene la base.

/** Ya resuelta a URLs: la vista no arma claves de Storage. */
export type ImagenDeFicha = {
  /** 1400px. */
  grande: string;
  /** 200px. */
  miniatura: string;
  /** Para `og:image`: una ruta de la tienda, no una URL de Storage. */
  og: string;
  /** `null`: lo completa quien lo muestra. */
  alt: string | null;
};

export type VarianteDeFicha = {
  id: string;
  /** Lo que va en `?color=`; en una de dos colores lo arma la vista `variant_colors`. */
  colorSlug: string | null;
  colorNombre: string | null;
  colorHex: string | null;
  /** `null` = de un solo color. */
  colorHex2: string | null;
  /** Puede ser negativo (RF-24). */
  disponible: number;
  /** Las propias o las de la variante que reutiliza. Puede venir vacía. */
  imagenes: ImagenDeFicha[];
};

export type Ficha = {
  id: string;
  slug: string;
  nombre: string;
  /** Markdown sanitizado al guardar; se vuelve a filtrar al pintar. */
  descripcion: string;
  /** La columna generada `description_text`, sin marcadores. */
  descripcionTexto: string;
  marca: string;
  sku: string | null;
  categoria: string;
  categoriaSlug: string;
  precio: Money;
  descuento: Money;
  precioFinal: Money;
  variantes: VarianteDeFicha[];
};

type FilaDeVariante = {
  id: string;
  colorSlug: string | null;
  colorNombre: string | null;
  colorHex: string | null;
  colorHex2: string | null;
  disponible: number;
  imagenes: { key: string; alt: string | null }[];
};

/**
 * `null` si no existe o está inactivo: hacia afuera no se distinguen (RN-05).
 * Con `cache` porque la piden la página y `generateMetadata`; Drizzle no
 * deduplica como `fetch`.
 */
export const leerFicha = cache(async function leerFicha(
  slug: string,
): Promise<Ficha | null> {
  const [fila] = await db.execute<
    Omit<Ficha, "variantes"> & { variantes: FilaDeVariante[] | null }
  >(sql`
    SELECT p.id,
           p.slug,
           p.name             AS nombre,
           p.description      AS descripcion,
           p.description_text AS "descripcionTexto",
           p.price            AS precio,
           p.discount         AS descuento,
           p.final_price      AS "precioFinal",
           b.name             AS marca,
           p.sku              AS sku,
           c.name             AS categoria,
           c.slug             AS "categoriaSlug",
           vs.lista           AS variantes
      FROM products p
      JOIN brands b     ON b.id = p.brand_id
      JOIN categories c ON c.id = p.category_id

      -- Las variantes activas con sus imágenes. El orden es el que configuró
      -- la vendedora y el nombre desempata: sort_order se renumera sin huecos,
      -- pero dos filas escritas por fuera del panel pueden compartir número, y
      -- sin desempate el selector de color cambiaría de orden entre dos cargas
      -- de la misma pantalla.
      LEFT JOIN LATERAL (
        SELECT coalesce(
                 json_agg(x.fila ORDER BY x.orden, x.nombre NULLS LAST),
                 '[]'::json
               ) AS lista
          FROM (
            SELECT v.sort_order AS orden,
                   co.name      AS nombre,
                   json_build_object(
                     'id',          v.id,
                     'colorSlug',   co.slug,
                     'colorNombre', co.name,
                     'colorHex',    co.hex_code,
                     'colorHex2',   co.hex_code_2,
                     'disponible',  v.stock_total - v.reserved_stock,
                     -- §9.5: una variante puede mostrar las fotos de otra.
                     -- Sin el coalesce, la que reutiliza sale sin ninguna.
                     'imagenes',    (
                       SELECT coalesce(
                                json_agg(
                                  json_build_object(
                                    'key', i.storage_key,
                                    'alt', i.alt_text
                                  )
                                  ORDER BY i.sort_order
                                ),
                                '[]'::json
                              )
                         FROM variant_images i
                        WHERE i.variant_id = coalesce(v.images_source_id, v.id)
                     )
                   ) AS fila
              FROM product_variants v
              LEFT JOIN variant_colors co ON co.variant_id = v.id
             WHERE v.product_id = p.id AND v.is_active
          ) x
      ) vs ON true

     WHERE p.slug = ${slug} AND p.is_active
  `);

  if (!fila) return null;

  return {
    ...fila,
    variantes: (fila.variantes ?? []).map((v) => ({
      id: v.id,
      colorSlug: v.colorSlug,
      colorNombre: v.colorNombre,
      colorHex: v.colorHex,
      colorHex2: v.colorHex2,
      disponible: v.disponible,
      // Acá y no en la galería: `urlDeImagen` es de servidor.
      imagenes: v.imagenes.map((i) => ({
        grande: urlDeImagen(i.key, "detail"),
        miniatura: urlDeImagen(i.key, "thumb"),
        og: rutaDeVistaPrevia(i.key),
        alt: i.alt,
      })),
    })),
  };
});

/**
 * Un `?color=` que no existe no es un 404: muestra la primera variante.
 * `-1` si el producto no tiene ninguna variante activa.
 */
export function varianteInicial(
  variantes: VarianteDeFicha[],
  color: string | undefined,
): number {
  if (variantes.length === 0) return -1;
  if (!color) return 0;
  const i = variantes.findIndex((v) => v.colorSlug === color);
  return i === -1 ? 0 : i;
}
