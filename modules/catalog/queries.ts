import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { brands, categories, colors } from "@/db/schema/catalog";
import { urlDeLogo } from "@/modules/media/subir";
import { POR_PAGINA } from "@/modules/catalog/filtros-panel";

// Cada listado trae cuántos productos activos e inactivos usan el ítem: eso
// decide qué acciones se ofrecen (RN-11, RN-11b).

export type ItemDeCatalogo = {
  id: string;
  name: string;
  slug: string;
  hexCode: string | null;
  /** `null` = el tipo no tiene la noción, como `hexCode` fuera de colores. */
  isFeatured: boolean | null;
  /** `null` = no tiene, o el tipo no lleva texto. */
  description: string | null;
  /** Ya resuelta: armarla es código de servidor y el panel es de cliente. */
  logoUrl: string | null;
  isActive: boolean;
  /** Si es > 0, no se puede desactivar. */
  activos: number;
  inactivos: number;
  /** En su orden; `null` en marcas y colores. */
  relacionadas: CategoriaRelacionada[] | null;
};

export type CategoriaRelacionada = {
  id: string;
  name: string;
  isActive: boolean;
  activos: number;
  reciproca: boolean;
};

export type CategoriaRelacionable = {
  id: string;
  name: string;
  activos: number;
};

export async function listarMarcas(
  pagina = 1,
): Promise<{ items: ItemDeCatalogo[]; total: number }> {
  const filas = await db.execute<
    ItemDeCatalogo & { logoKey: string | null }
  >(sql`
    SELECT b.id, b.name, b.slug, NULL::text AS "hexCode",
           NULL::boolean AS "isFeatured",
           NULL::text AS description,
           NULL::json AS relacionadas,
           b.logo_key AS "logoKey",
           b.is_active AS "isActive",
           count(p.id) FILTER (WHERE p.is_active)     ::int AS activos,
           count(p.id) FILTER (WHERE NOT p.is_active) ::int AS inactivos
      FROM ${brands} b
      LEFT JOIN products p ON p.brand_id = b.id
     GROUP BY b.id
     -- El id desempata: sin criterio único, con LIMIT una marca puede salir
     -- en dos páginas o en ninguna.
     ORDER BY immutable_unaccent(lower(b.name)), b.id
     LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}
  `);

  return {
    items: filas.map(({ logoKey, ...fila }) => ({
      ...fila,
      logoUrl: urlDeLogo(logoKey, "thumb"),
    })),
    total: await contar(sql`${brands}`),
  };
}

/** En el mismo orden en que las ve el comprador: destacadas primero. */
export async function listarCategorias(
  pagina = 1,
): Promise<{ items: ItemDeCatalogo[]; total: number }> {
  const filas = await db.execute<
    ItemDeCatalogo & { imageKey: string | null }
  >(sql`
    SELECT c.id, c.name, c.slug, NULL::text AS "hexCode",
           c.is_featured AS "isFeatured",
           c.description,
           -- RF-31. Subconsulta y no JOIN: con el JOIN de productos de abajo,
           -- cada relación se multiplicaría por los productos de la fila.
           (SELECT COALESCE(json_agg(json_build_object(
                     'id', r.id, 'name', r.name, 'isActive', r.is_active,
                     'activos', (SELECT count(*) FROM products rp
                                  WHERE rp.category_id = r.id
                                    AND rp.is_active),
                     'reciproca', cr.is_reciprocal)
                   ORDER BY cr.sort_order, r.id), '[]'::json)
              FROM category_relations cr
              JOIN ${categories} r ON r.id = cr.related_category_id
             WHERE cr.category_id = c.id) AS relacionadas,
           c.image_key AS "imageKey",
           c.is_active AS "isActive",
           count(p.id) FILTER (WHERE p.is_active)     ::int AS activos,
           count(p.id) FILTER (WHERE NOT p.is_active) ::int AS inactivos
      FROM ${categories} c
      LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.is_featured DESC, immutable_unaccent(lower(c.name)), c.id
     LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}
  `);

  return {
    items: filas.map(({ imageKey, ...fila }) => ({
      ...fila,
      logoUrl: urlDeLogo(imageKey, "thumb"),
    })),
    total: await contar(sql`${categories}`),
  };
}

/** Todas las activas, sin paginar. La propia y las ya elegidas las saca el diálogo. */
export async function listarRelacionables(): Promise<CategoriaRelacionable[]> {
  const filas = await db.execute<CategoriaRelacionable>(sql`
    SELECT c.id, c.name,
           count(p.id) FILTER (WHERE p.is_active)::int AS activos
      FROM ${categories} c
      LEFT JOIN products p ON p.category_id = c.id
     WHERE c.is_active
     GROUP BY c.id
     ORDER BY immutable_unaccent(lower(c.name)), c.id
  `);
  return [...filas];
}

export async function listarColores(
  pagina = 1,
): Promise<{ items: ItemDeCatalogo[]; total: number }> {
  // Un color se usa a través de las variantes, como primero o segundo color.
  // A diferencia de marcas y categorías, `activos` mira también `v.is_active`:
  // lo que impide desactivarlo es una variante activa de un producto activo
  // (RN-11b). `inactivos` acá es «lo usa sin ofrecerlo».
  const filas = await db.execute<ItemDeCatalogo>(sql`
    SELECT c.id, c.name, c.slug, c.hex_code AS "hexCode",
           NULL::boolean AS "isFeatured",
           NULL::text AS description,
           NULL::json AS relacionadas,
           NULL::text AS "logoUrl",
           c.is_active AS "isActive",
           count(DISTINCT p.id) FILTER (WHERE p.is_active AND v.is_active)
             ::int AS activos,
           count(DISTINCT p.id) FILTER (WHERE NOT (p.is_active AND v.is_active))
             ::int AS inactivos
      FROM ${colors} c
      LEFT JOIN product_variants v
        ON c.id IN (v.color_id, v.secondary_color_id)
      LEFT JOIN products p ON p.id = v.product_id
     GROUP BY c.id
     ORDER BY immutable_unaccent(lower(c.name)), c.id
     LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}
  `);

  return { items: [...filas], total: await contar(sql`${colors}`) };
}

async function contar(tabla: ReturnType<typeof sql>): Promise<number> {
  const [fila] = await db.execute<{ total: number }>(
    sql`SELECT count(*)::int AS total FROM ${tabla}`,
  );
  return fila?.total ?? 0;
}
