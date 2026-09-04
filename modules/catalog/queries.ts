import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { brands, categories, colors } from "@/db/schema/catalog";
import { urlDeLogo } from "@/modules/media/subir";
import type { TipoDeItem } from "@/modules/catalog/schemas";

/**
 * Lecturas del catálogo para el panel — RF-18.
 *
 * Cada listado trae, además del ítem, CUÁNTOS PRODUCTOS lo usan, separando
 * activos de inactivos. La separación no es informativa: es la que decide qué
 * acciones se ofrecen. Con productos activos no se puede desactivar (RN-11b);
 * con productos de cualquier tipo no se puede borrar (RN-11).
 *
 * Los conteos vienen en la MISMA consulta que el listado, con `count(...)
 * FILTER`. Pedirlos aparte serían N+1 consultas para pintar una tabla.
 */

export type ItemDeCatalogo = {
  id: string;
  name: string;
  slug: string;
  hexCode: string | null;
  /**
   * `null` = el tipo no tiene la noción. Sólo las categorías se destacan
   * (RF-18); marcas y colores devuelven `null`, igual que `hexCode` es
   * `null` para todo lo que no es un color. Así la vista pregunta por el
   * dato y no por el tipo.
   */
  isFeatured: boolean | null;
  /**
   * La URL del logo, ya resuelta. `null` = la marca no tiene, o el tipo no
   * lleva logo. La vista recibe una URL y no una clave a propósito: armarla
   * necesita el adaptador de almacenamiento (§9.4), que es código de
   * servidor, y el panel es un componente de cliente.
   */
  logoUrl: string | null;
  isActive: boolean;
  /** Productos activos que lo usan. Si es > 0, no se puede desactivar. */
  activos: number;
  /** Productos inactivos que lo usan. */
  inactivos: number;
};

export async function listarMarcas(): Promise<ItemDeCatalogo[]> {
  const filas = await db.execute<ItemDeCatalogo & { logoKey: string | null }>(sql`
    SELECT b.id, b.name, b.slug, NULL::text AS "hexCode",
           NULL::boolean AS "isFeatured",
           b.logo_key AS "logoKey",
           b.is_active AS "isActive",
           count(p.id) FILTER (WHERE p.is_active)     ::int AS activos,
           count(p.id) FILTER (WHERE NOT p.is_active) ::int AS inactivos
      FROM ${brands} b
      LEFT JOIN products p ON p.brand_id = b.id
     GROUP BY b.id
     ORDER BY immutable_unaccent(lower(b.name))
  `);

  // La clave se convierte en URL acá y no en la consulta: la base guarda
  // claves justamente para no saber en qué servidor vive Storage (§9.4).
  return filas.map(({ logoKey, ...fila }) => ({
    ...fila,
    logoUrl: urlDeLogo(logoKey, "thumb"),
  }));
}

/**
 * Las categorías se listan en el MISMO orden en que las ve el comprador
 * (§10.2): destacadas primero, después por nombre. El panel no tiene un orden
 * propio a propósito — destacar es una decisión sobre el orden, y se juzga
 * mal si la pantalla donde se toma la muestra de otra manera.
 */
export async function listarCategorias(): Promise<ItemDeCatalogo[]> {
  return db.execute<ItemDeCatalogo>(sql`
    SELECT c.id, c.name, c.slug, NULL::text AS "hexCode",
           c.is_featured AS "isFeatured",
           NULL::text AS "logoUrl",
           c.is_active AS "isActive",
           count(p.id) FILTER (WHERE p.is_active)     ::int AS activos,
           count(p.id) FILTER (WHERE NOT p.is_active) ::int AS inactivos
      FROM ${categories} c
      LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.is_featured DESC, immutable_unaccent(lower(c.name))
  `);
}

export async function listarColores(): Promise<ItemDeCatalogo[]> {
  // Un color se usa a través de las VARIANTES, no de los productos. Se cuenta
  // el producto una sola vez aunque tenga dos variantes de ese color —no
  // puede, por `variant_product_color_key`, pero el DISTINCT deja la consulta
  // correcta si esa restricción cambiara.
  //
  // **`activos` mira también `v.is_active`, y esa es la diferencia con marcas
  // y categorías.** Lo que impide desactivar un color es lo que dice RN-11b:
  // una variante ACTIVA de un producto ACTIVO. Contar el producto sin mirar
  // la variante deja sin salida a quien desactivó el color en el producto y
  // vuelve a intentarlo: el aviso le pide desactivar un producto que ya no
  // ofrece ese color. Hasta F2.4 no había variantes y esto no se podía ver.
  //
  // El resto de los usos cae en `inactivos`, que acá significa «lo usa sin
  // ofrecerlo»: el producto puede estar inactivo, o tener apagada justo la
  // variante de este color. En los dos casos desactivar el color no rompe
  // nada, que es lo que la columna tiene que responder.
  return db.execute<ItemDeCatalogo>(sql`
    SELECT c.id, c.name, c.slug, c.hex_code AS "hexCode",
           NULL::boolean AS "isFeatured",
           NULL::text AS "logoUrl",
           c.is_active AS "isActive",
           count(DISTINCT p.id) FILTER (WHERE p.is_active AND v.is_active)
             ::int AS activos,
           count(DISTINCT p.id) FILTER (WHERE NOT (p.is_active AND v.is_active))
             ::int AS inactivos
      FROM ${colors} c
      LEFT JOIN product_variants v ON v.color_id = c.id
      LEFT JOIN products p ON p.id = v.product_id
     GROUP BY c.id
     ORDER BY immutable_unaccent(lower(c.name))
  `);
}

export const LISTADOS: Record<TipoDeItem, () => Promise<ItemDeCatalogo[]>> = {
  marca: listarMarcas,
  categoria: listarCategorias,
  color: listarColores,
};
