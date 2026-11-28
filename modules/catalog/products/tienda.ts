import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { ProductoEnTarjeta } from "@/components/shop/tarjeta-producto";
import {
  comoFiltroDeCategoria,
  FILTROS_DE_TIENDA_VACIOS,
  POR_PAGINA,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";

// No filtra por `b.is_active` ni `c.is_active` a propósito: RN-11b garantiza
// que un producto activo no tiene marca, categoría ni color inactivos.

/** Buscar «50%» no puede traer todo. */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

/** Calibrado en TECHNICAL-SPEC §10.1. */
const UMBRAL_DE_PARECIDO = 0.4;

function terminoNormalizado(q: string): SQL {
  return sql`immutable_unaccent(lower(${q}))`;
}

const MARCA_Y_NOMBRE = sql`immutable_unaccent(lower(b.name || ' ' || p.name))`;

function parecido(q: string): SQL {
  return sql`strict_word_similarity(${terminoNormalizado(q)}, ${MARCA_Y_NOMBRE})`;
}

function contieneElTermino(q: string): SQL {
  const termino = terminoNormalizado(escaparComodines(q));
  return sql`(
       immutable_unaccent(lower(p.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.sku))              ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(b.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.description_text)) ILIKE '%' || ${termino} || '%'
  )`;
}

/**
 * El umbral va en la comparación y no en `pg_trgm.*_threshold`: esa variable
 * es por sesión, y con el pool habría que fijarla en cada consulta.
 */
function condicionDeBusqueda(q: string): SQL {
  return sql`(${contieneElTermino(q)} OR ${parecido(q)} >= ${UMBRAL_DE_PARECIDO})`;
}

/** Con los valores como parámetros: nunca `sql.raw`, aunque ya estén validados. */
export function enLaLista(columna: SQL, ids: readonly string[]): SQL {
  return sql`${columna} IN (${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

function losSlugs(columna: SQL, slugs: readonly string[]): SQL {
  return sql`${columna} IN (${sql.join(
    slugs.map((slug) => sql`${slug}`),
    sql`, `,
  )})`;
}

function condiciones(f: FiltrosDeTienda): SQL {
  const partes: SQL[] = [sql`p.is_active`];

  if (f.q) partes.push(condicionDeBusqueda(f.q));

  // Dentro de un grupo las opciones se suman (O); entre grupos se cruzan (Y).
  const categorias = f.seccion ? [f.seccion] : f.categoria;
  if (categorias.length) {
    partes.push(sql`p.category_id IN (
      SELECT id FROM categories WHERE ${losSlugs(sql`slug`, categorias)})`);
  }
  if (f.marca.length) partes.push(losSlugs(sql`b.slug`, f.marca));

  // EXISTS y no JOIN: con el JOIN, un producto saldría una vez por variante.
  if (f.color.length) {
    partes.push(sql`EXISTS (
      SELECT 1 FROM product_variants v
       WHERE v.product_id = p.id AND v.is_active
         AND EXISTS (
           SELECT 1 FROM colors co
            WHERE co.id IN (v.color_id, v.secondary_color_id)
              AND ${losSlugs(sql`co.slug`, f.color)})
    )`);
  }

  // Sobre el precio final, no sobre `price` (RF-02).
  if (f.precioMin !== null) partes.push(sql`p.final_price >= ${f.precioMin}`);
  if (f.precioMax !== null) partes.push(sql`p.final_price <= ${f.precioMax}`);

  if (f.oferta) partes.push(sql`p.discount > 0`);

  return sql.join(partes, sql` AND `);
}

const ORDEN: Record<FiltrosDeTienda["orden"], SQL> = {
  relevancia: sql`p.is_featured DESC, immutable_unaccent(lower(p.name))`,
  "precio-asc": sql`p.final_price ASC`,
  "precio-desc": sql`p.final_price DESC`,
  nombre: sql`immutable_unaccent(lower(p.name))`,
  novedades: sql`p.created_at DESC`,
};

/** Con búsqueda y orden por omisión, lo que contiene el término tal cual vale 1. */
function orden(f: FiltrosDeTienda): SQL {
  if (!f.q || f.orden !== "relevancia") return ORDEN[f.orden];
  return sql`CASE WHEN ${contieneElTermino(f.q)} THEN 1
                  ELSE ${parecido(f.q)} END DESC, ${ORDEN.relevancia}`;
}

/**
 * Para toda pantalla que dibuje la tarjeta, así no muestra otra portada u otro
 * stock. Los dos fragmentos esperan `p` (products) y `b` (brands) en el FROM.
 */
export const COLUMNAS_DE_TARJETA = sql`
  p.id,
  p.slug,
  p.name            AS nombre,
  b.name            AS marca,
  p.price           AS precio,
  p.discount        AS descuento,
  p.final_price     AS "precioFinal",
  img.storage_key   AS "imagenKey",
  img.color,
  cols.lista        AS colores,
  st.disponible`;

export const UNIONES_DE_TARJETA = sql`
  -- El stock que se puede vender: total menos lo comprometido por
  -- órdenes activas (§8.1). Se suma sobre las variantes ACTIVAS, porque
  -- una desactivada no se ofrece aunque tenga unidades.
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(v.stock_total - v.reserved_stock), 0)::int AS disponible
      FROM product_variants v
     WHERE v.product_id = p.id AND v.is_active
  ) st ON true

  -- La foto de portada: la primera de la primera variante que tenga.
  -- El coalesce(images_source_id, id) es §9.5: una variante puede
  -- mostrar las fotos de otra, y sin esto una que reutiliza saldría sin
  -- imagen aunque en la ficha se vea perfecta.
  --
  -- El ORDEN es el MISMO que el del selector de color de la ficha
  -- (ficha.ts): sort_order de la variante y después el nombre del color.
  -- Desempataba por v.id, que es un UUID al azar, así que la tarjeta
  -- podía mostrar el teclado negro y la ficha abrir en el blanco. Eso no
  -- se veía hasta que existió la ficha, y es de las cosas que nadie
  -- reporta como error: se siente como que el sitio cambió de producto.
  LEFT JOIN LATERAL (
    SELECT i.storage_key, co.name AS color
      FROM product_variants v
      LEFT JOIN variant_colors co ON co.variant_id = v.id
      JOIN variant_images i
        ON i.variant_id = coalesce(v.images_source_id, v.id)
     WHERE v.product_id = p.id AND v.is_active
     ORDER BY v.sort_order, co.name NULLS LAST, i.sort_order
     LIMIT 1
  ) img ON true

  -- Los puntos de color de la tarjeta (§6.1). DISTINCT en el
  -- subselect y no en el agregado: dos variantes negras del mismo
  -- producto pintarían dos puntos negros idénticos.
  LEFT JOIN LATERAL (
    SELECT coalesce(
             json_agg(
               json_build_object('nombre', c.nombre, 'hex', c.hex,
                                 'hex2', c.hex2)
               ORDER BY c.nombre
             ),
             '[]'::json
           ) AS lista
      FROM (
        SELECT DISTINCT co.name AS nombre, co.hex_code AS hex,
               co.hex_code_2 AS hex2
          FROM product_variants v
          JOIN variant_colors co ON co.variant_id = v.id
         WHERE v.product_id = p.id AND v.is_active
      ) c
  ) cols ON true`;

export type FilaDeTarjeta = {
  id: string;
  slug: string;
  nombre: string;
  marca: string;
  precio: string;
  descuento: string;
  precioFinal: string;
  imagenKey: string | null;
  color: string | null;
  colores: { nombre: string; hex: string; hex2: string | null }[] | null;
  disponible: number;
};

export function aTarjeta(r: FilaDeTarjeta): ProductoEnTarjeta {
  return {
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    marca: r.marca,
    precio: r.precio,
    descuento: r.descuento,
    precioFinal: r.precioFinal,
    imagenKey: r.imagenKey,
    color: r.color,
    colores: r.colores ?? [],
    disponible: r.disponible,
  };
}

export type PaginaDelCatalogo = {
  productos: ProductoEnTarjeta[];
  total: number;
  /** En la tienda o en la categoría de la página. */
  totalSinFiltros: number;
};

/** `totalSinFiltros` separa «todavía no hay productos» de «sin resultados». */
export async function leerPaginaDelCatalogo(
  f: FiltrosDeTienda,
): Promise<PaginaDelCatalogo> {
  const donde = condiciones(f);
  const desde = (f.pagina - 1) * POR_PAGINA;

  const [filas, [conteo], [todos]] = await Promise.all([
    db.execute<FilaDeTarjeta>(sql`
      SELECT ${COLUMNAS_DE_TARJETA}
        FROM products p
        JOIN brands b ON b.id = p.brand_id
        ${UNIONES_DE_TARJETA}
       WHERE ${donde}
       ORDER BY ${orden(f)}, p.id
       LIMIT ${POR_PAGINA} OFFSET ${desde}`),

    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n
        FROM products p
        JOIN brands b ON b.id = p.brand_id
       WHERE ${donde}`),

    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM products p
       WHERE p.is_active ${
         f.seccion
           ? sql`AND p.category_id IN (SELECT id FROM categories WHERE slug = ${f.seccion})`
           : sql``
       }`),
  ]);

  return {
    productos: filas.map(aTarjeta),
    total: conteo.n,
    totalSinFiltros: todos.n,
  };
}

export type OpcionDeFiltro = { slug: string; nombre: string; cuantos: number };

export type OpcionDeColor = OpcionDeFiltro & { hex: string };

/**
 * Cada grupo se calcula con los filtros de los otros grupos (DESIGN-REFERENCE
 * §7.2). Lo elegido sale siempre, aunque quede en cero, para poder sacarlo.
 * El orden es por productos activos en toda la tienda, para que no salte.
 */
export async function leerOpcionesDeFiltro(
  filtros: FiltrosDeTienda = FILTROS_DE_TIENDA_VACIOS,
): Promise<{
  categorias: OpcionDeFiltro[];
  marcas: OpcionDeFiltro[];
  colores: OpcionDeColor[];
  precios: { min: number; max: number } | null;
  /** Con los demás filtros. Con cero, la casilla llevaría a un vacío. */
  enOferta: number;
}> {
  const f = comoFiltroDeCategoria(filtros);

  const coincidentes = (sinElGrupo: Partial<FiltrosDeTienda>) => sql`
    SELECT p.id, p.category_id, p.brand_id, p.final_price
      FROM products p
      JOIN brands b ON b.id = p.brand_id
     WHERE ${condiciones({ ...f, ...sinElGrupo })}`;

  const elegido = (columna: SQL, slugs: readonly string[]) =>
    slugs.length ? losSlugs(columna, slugs) : sql`false`;

  const [categorias, marcas, colores, [precios], [ofertas]] = await Promise.all(
    [
      db.execute<OpcionDeFiltro>(sql`
      WITH x AS (${coincidentes({ categoria: [] })})
      SELECT c.slug, c.name AS nombre, count(x.id)::int AS cuantos
        FROM categories c
        LEFT JOIN x ON x.category_id = c.id
       GROUP BY c.id
      HAVING count(x.id) > 0 OR ${elegido(sql`c.slug`, f.categoria)}
       ORDER BY c.is_featured DESC,
                (SELECT count(*) FROM products t
                  WHERE t.category_id = c.id AND t.is_active) DESC,
                immutable_unaccent(lower(c.name))`),

      db.execute<OpcionDeFiltro>(sql`
      WITH x AS (${coincidentes({ marca: [] })})
      SELECT b.slug, b.name AS nombre, count(x.id)::int AS cuantos
        FROM brands b
        LEFT JOIN x ON x.brand_id = b.id
       GROUP BY b.id
      HAVING count(x.id) > 0 OR ${elegido(sql`b.slug`, f.marca)}
       ORDER BY (SELECT count(*) FROM products t
                  WHERE t.brand_id = b.id AND t.is_active) DESC,
                immutable_unaccent(lower(b.name))`),

      // DISTINCT: un producto con dos variantes negras se contaría dos veces.
      // Una variante de dos colores suma en los dos.
      db.execute<OpcionDeColor>(sql`
      WITH x AS (${coincidentes({ color: [] })})
      SELECT co.slug,
             co.name     AS nombre,
             co.hex_code AS hex,
             count(DISTINCT x.id)::int AS cuantos
        FROM colors co
        LEFT JOIN product_variants v
          ON co.id IN (v.color_id, v.secondary_color_id) AND v.is_active
        LEFT JOIN x ON x.id = v.product_id
       GROUP BY co.id
      HAVING count(x.id) > 0 OR ${elegido(sql`co.slug`, f.color)}
       ORDER BY (SELECT count(DISTINCT t.id)
                   FROM products t
                   JOIN product_variants tv
                     ON tv.product_id = t.id AND tv.is_active
                  WHERE t.is_active
                    AND co.id IN (tv.color_id, tv.secondary_color_id)) DESC,
                immutable_unaccent(lower(co.name))`),

      // Redondeado hacia afuera para que las puntas queden adentro.
      db.execute<{ min: number | null; max: number | null }>(sql`
      WITH x AS (${coincidentes({ precioMin: null, precioMax: null })})
      SELECT floor(min(final_price))::int AS min,
             ceil(max(final_price))::int  AS max
        FROM x`),

      db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n
        FROM products p
        JOIN brands b ON b.id = p.brand_id
       WHERE ${condiciones({ ...f, oferta: true })}`),
    ],
  );

  return {
    categorias: [...categorias],
    marcas: [...marcas],
    colores: [...colores],
    precios:
      precios &&
      precios.min !== null &&
      precios.max !== null &&
      precios.max > precios.min
        ? { min: precios.min, max: precios.max }
        : null,
    enOferta: ofertas.n,
  };
}
