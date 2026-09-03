import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Lecturas de productos para el panel — RF-15.
 *
 * El LISTADO de F2.5 —búsqueda, filtros, orden y aviso de stock bajo— no está
 * acá todavía: esto es lo mínimo para llegar al formulario y volver. Lo que
 * sí trae desde ahora es el stock, porque sale de la misma consulta con un
 * `LEFT JOIN` y pedirlo aparte sería N+1 el día que se agreguen los filtros.
 */

export type ProductoDelListado = {
  id: string;
  name: string;
  slug: string;
  brandName: string;
  categoryName: string;
  price: string;
  discount: string;
  finalPrice: string;
  isFeatured: boolean;
  isActive: boolean;
  /** Suma de las variantes. `0` mientras el producto no tenga ninguna (F2.4). */
  stockTotal: number;
  variantes: number;
};

export async function listarProductos(): Promise<ProductoDelListado[]> {
  return db.execute<ProductoDelListado>(sql`
    SELECT p.id, p.name, p.slug,
           b.name AS "brandName",
           c.name AS "categoryName",
           p.price, p.discount,
           p.final_price  AS "finalPrice",
           p.is_featured  AS "isFeatured",
           p.is_active    AS "isActive",
           COALESCE(sum(v.stock_total), 0)::int AS "stockTotal",
           count(v.id)::int                     AS variantes
      FROM products p
      JOIN brands b     ON b.id = p.brand_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_variants v ON v.product_id = p.id
     GROUP BY p.id, b.name, c.name
     ORDER BY p.is_featured DESC, immutable_unaccent(lower(p.name))
  `);
}

export type ProductoParaEditar = {
  id: string;
  name: string;
  slug: string;
  description: string;
  brandId: string;
  categoryId: string;
  price: string;
  discount: string;
  isFeatured: boolean;
  isActive: boolean;
};

export async function obtenerProducto(
  id: string,
): Promise<ProductoParaEditar | null> {
  const [fila] = await db.execute<ProductoParaEditar>(sql`
    SELECT id, name, slug, description,
           brand_id    AS "brandId",
           category_id AS "categoryId",
           price, discount,
           is_featured AS "isFeatured",
           is_active   AS "isActive"
      FROM products WHERE id = ${id}
  `);
  return fila ?? null;
}

export type OpcionDeCatalogo = { id: string; name: string; isActive: boolean };

/**
 * Las marcas y categorías del formulario.
 *
 * Vienen TODAS, con su estado, y no solo las activas. Un producto inactivo
 * puede tener marca inactiva —RN-11b prohíbe la combinación activo+inactivo,
 * no la otra—, y si la consulta trajera solo las activas, abrir ese producto
 * mostraría el selector en blanco y guardar le cambiaría la marca sin que
 * nadie lo pidiera. El formulario ofrece las activas y deja ver la que ya
 * está puesta.
 */
export async function opcionesDeProducto(): Promise<{
  marcas: OpcionDeCatalogo[];
  categorias: OpcionDeCatalogo[];
}> {
  const [marcas, categorias] = await Promise.all([
    db.execute<OpcionDeCatalogo>(sql`
      SELECT id, name, is_active AS "isActive" FROM brands
       ORDER BY is_active DESC, immutable_unaccent(lower(name))`),
    db.execute<OpcionDeCatalogo>(sql`
      SELECT id, name, is_active AS "isActive" FROM categories
       ORDER BY is_active DESC, is_featured DESC, immutable_unaccent(lower(name))`),
  ]);

  return { marcas, categorias };
}
