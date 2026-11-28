import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  POR_PAGINA,
  type EstadoDeProductos,
  type FiltrosDeProductos,
} from "@/modules/catalog/products/filtros";

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
  /** `0` mientras el producto no tenga variantes. */
  stockTotal: number;
  reservado: number;
  disponible: number;
  variantes: number;
  /** Por variante: una en −3 y otra en +10 suman 7 y en el total no se vería. */
  variantesEnNegativo: number;
};

/** Sin esto, buscar «50%» traería todo. */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

/**
 * Solo la mitad por subcadena de TECHNICAL-SPEC §10.1, sin trigramas: la
 * vendedora busca algo que sabe que existe, y los parecidos se lo esconden.
 */
function condicionDeBusqueda(q: string): SQL {
  const termino = sql`immutable_unaccent(lower(${escaparComodines(q)}))`;
  return sql`(
       immutable_unaccent(lower(p.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.sku))              ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(b.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.description_text)) ILIKE '%' || ${termino} || '%'
  )`;
}

const DISPONIBLE = sql`COALESCE(sum(v.stock_total - v.reserved_stock), 0)`;

/**
 * `total` es el de los filtros puestos, no el de la página. Se cuenta por
 * subconsulta porque el filtro de stock está en un `HAVING`.
 */
export async function listarProductos(
  filtros: FiltrosDeProductos,
  umbralDeStockBajo: number,
): Promise<{ productos: ProductoDelListado[]; total: number }> {
  const condiciones: SQL[] = [];
  if (filtros.q) condiciones.push(condicionDeBusqueda(filtros.q));
  if (filtros.categoria) {
    condiciones.push(sql`p.category_id = ${filtros.categoria}::uuid`);
  }
  if (filtros.marca) {
    condiciones.push(sql`p.brand_id = ${filtros.marca}::uuid`);
  }
  if (filtros.estado !== "todos") {
    condiciones.push(
      filtros.estado === "activos" ? sql`p.is_active` : sql`NOT p.is_active`,
    );
  }
  const where = condiciones.length
    ? sql`WHERE ${sql.join(condiciones, sql` AND `)}`
    : sql``;

  // En HAVING y no en WHERE: en WHERE se evaluaría variante por variante.
  const having =
    filtros.stock === "todos"
      ? sql``
      : filtros.stock === "sin"
        ? sql`HAVING ${DISPONIBLE} <= 0`
        : sql`HAVING ${DISPONIBLE} <= ${umbralDeStockBajo}`;

  const dir = filtros.dir === "asc" ? sql`ASC` : sql`DESC`;
  const porNombre = sql`immutable_unaccent(lower(p.name))`;
  const criterio: SQL =
    filtros.orden === "nombre"
      ? sql`${porNombre} ${dir}`
      : filtros.orden === "precio"
        ? sql`p.final_price ${dir}`
        : filtros.orden === "stock"
          ? sql`${DISPONIBLE} ${dir}`
          : filtros.orden === "fecha"
            ? sql`p.created_at ${dir}`
            : // Es una bandera, no una escala: ignora la dirección.
              sql`p.is_featured DESC`;

  // El conteo no puede recortar junturas: la búsqueda y el filtro las usan.
  const deDonde = sql`
      FROM products p
      JOIN brands b     ON b.id = p.brand_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_variants v ON v.product_id = p.id
      ${where}
     GROUP BY p.id, b.name, c.name
      ${having}`;

  const [productos, [conteo]] = await Promise.all([
    db.execute<ProductoDelListado>(sql`
    SELECT p.id, p.name, p.slug,
           b.name AS "brandName",
           c.name AS "categoryName",
           p.price, p.discount,
           p.final_price  AS "finalPrice",
           p.is_featured  AS "isFeatured",
           p.is_active    AS "isActive",
           COALESCE(sum(v.stock_total), 0)::int    AS "stockTotal",
           COALESCE(sum(v.reserved_stock), 0)::int AS "reservado",
           ${DISPONIBLE}::int                      AS "disponible",
           count(v.id)::int                        AS variantes,
           count(v.id) FILTER (WHERE v.stock_total < 0)::int
             AS "variantesEnNegativo"
      ${deDonde}
     -- El nombre desempata siempre, y el id detrás: sin un criterio único,
     -- dos productos del mismo precio pueden cambiar de lugar entre dos
     -- cargas de la misma pantalla. Con paginación deja de ser cosmético: sin
     -- desempate, un producto puede aparecer en dos páginas o en ninguna.
     ORDER BY ${criterio}, ${porNombre} ASC, p.id
     LIMIT ${POR_PAGINA} OFFSET ${(filtros.pagina - 1) * POR_PAGINA}
  `),
    db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM (SELECT p.id ${deDonde}) AS t`),
  ]);

  return { productos: [...productos], total: conteo?.total ?? 0 };
}

/**
 * Sin mirar los filtros, a propósito. `todos` separa «todavía no cargaste
 * ninguno» de «ninguno coincide».
 */
export async function contarPorEstado(): Promise<
  Record<EstadoDeProductos, number>
> {
  const [fila] = await db.execute<Record<EstadoDeProductos, number>>(sql`
    SELECT count(*)::int                                     AS "todos",
           count(*) FILTER (WHERE is_active)::int            AS "activos",
           count(*) FILTER (WHERE NOT is_active)::int        AS "inactivos"
      FROM products`);

  return fila ?? { todos: 0, activos: 0, inactivos: 0 };
}

export type ProductoParaEditar = {
  id: string;
  name: string;
  sku: string | null;
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
    SELECT id, name, sku, slug, description,
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
 * Todas, con su estado: un producto inactivo puede tener marca inactiva, y
 * sin ella el selector quedaría en blanco y guardar se la cambiaría.
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
