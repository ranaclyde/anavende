import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { brands, categories, colors } from "@/db/schema/catalog";
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
  isActive: boolean;
  /** Productos activos que lo usan. Si es > 0, no se puede desactivar. */
  activos: number;
  /** Productos inactivos que lo usan. */
  inactivos: number;
};

export async function listarMarcas(): Promise<ItemDeCatalogo[]> {
  return db.execute<ItemDeCatalogo>(sql`
    SELECT b.id, b.name, b.slug, NULL::text AS "hexCode",
           b.is_active AS "isActive",
           count(p.id) FILTER (WHERE p.is_active)     ::int AS activos,
           count(p.id) FILTER (WHERE NOT p.is_active) ::int AS inactivos
      FROM ${brands} b
      LEFT JOIN products p ON p.brand_id = b.id
     GROUP BY b.id
     ORDER BY immutable_unaccent(lower(b.name))
  `);
}

export async function listarCategorias(): Promise<ItemDeCatalogo[]> {
  return db.execute<ItemDeCatalogo>(sql`
    SELECT c.id, c.name, c.slug, NULL::text AS "hexCode",
           c.is_active AS "isActive",
           count(p.id) FILTER (WHERE p.is_active)     ::int AS activos,
           count(p.id) FILTER (WHERE NOT p.is_active) ::int AS inactivos
      FROM ${categories} c
      LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY immutable_unaccent(lower(c.name))
  `);
}

export async function listarColores(): Promise<ItemDeCatalogo[]> {
  // Un color se usa a través de las VARIANTES, no de los productos. Se cuenta
  // el producto una sola vez aunque tenga dos variantes de ese color —no
  // puede, por `variant_product_color_key`, pero el DISTINCT deja la consulta
  // correcta si esa restricción cambiara.
  return db.execute<ItemDeCatalogo>(sql`
    SELECT c.id, c.name, c.slug, c.hex_code AS "hexCode",
           c.is_active AS "isActive",
           count(DISTINCT p.id) FILTER (WHERE p.is_active)     ::int AS activos,
           count(DISTINCT p.id) FILTER (WHERE NOT p.is_active) ::int AS inactivos
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
