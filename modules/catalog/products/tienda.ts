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

/**
 * El catálogo público — F3.4, RF-02, §10.1, §10.2.
 *
 * **Por qué no filtra por `b.is_active` ni `c.is_active`.** Parece un olvido y
 * es justo lo contrario: RN-11b prohíbe que un producto ACTIVO tenga marca,
 * categoría o color inactivos, y esa invariante la sostiene la base. Agregar
 * la condición acá sería sumar una segunda defensa que hay que acordarse de
 * repetir en cada consulta pública nueva — y el día que se olvide, esa
 * pantalla muestra de más. La decisión está registrada en §5.4.
 */

/** Los comodines de ILIKE se escapan: buscar «50%» no puede traer todo. */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

/**
 * La búsqueda de la tienda, por ahora **la mitad por subcadena de §10.1**.
 *
 * La otra mitad —similitud por trigramas, la que hace que «lojitech» encuentre
 * «Logitech»— es F3.3, y su «Hecho cuando» pide el umbral «calibrado con el
 * catálogo real». Calibrarlo contra productos de demostración daría un número
 * que no sirve para el catálogo de Ana, así que queda para después de F2.8 y
 * no se agrega a medias: un umbral mal puesto no falla, muestra cosas que no
 * tienen nada que ver, que es peor.
 */
function condicionDeBusqueda(q: string): SQL {
  const termino = sql`immutable_unaccent(lower(${escaparComodines(q)}))`;
  // El SKU se busca desde el 2026-11-05, cuando empezó a verse en la
  // ficha: si se muestra, quien lo copia tiene que poder encontrarlo.
  return sql`(
       immutable_unaccent(lower(p.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.sku))              ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(b.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.description_text)) ILIKE '%' || ${termino} || '%'
  )`;
}

/**
 * `columna IN (a, b, c)` con los valores como parámetros.
 *
 * Los identificadores NO se interpolan en el texto de la consulta ni siquiera
 * después de haber pasado por la validación de UUID: la validación protege de
 * lo que ya conocemos, y un `sql.raw` acá sería una inyección esperando a que
 * alguien afloje esa expresión. Es la misma decisión que el reordenamiento de
 * imágenes de `modules/media/subir.ts`.
 */
export function enLaLista(columna: SQL, ids: readonly string[]): SQL {
  return sql`${columna} IN (${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

/** `columna IN ('a', 'b')` con los slugs como parámetros, como `enLaLista`. */
function losSlugs(columna: SQL, slugs: readonly string[]): SQL {
  return sql`${columna} IN (${sql.join(
    slugs.map((slug) => sql`${slug}`),
    sql`, `,
  )})`;
}

function condiciones(f: FiltrosDeTienda): SQL {
  const partes: SQL[] = [sql`p.is_active`];

  if (f.q) partes.push(condicionDeBusqueda(f.q));

  // Multiselección (RF-02): dentro de un grupo las opciones se suman —«Teclados
  // O Mouses»— y entre grupos se cruzan —«(Teclados O Mouses) Y Logitech»—.
  // Es lo que espera cualquiera que haya usado un filtro de tienda, y lo
  // contrario —cruzar dentro del grupo— daría cero resultados siempre: ningún
  // producto es de dos categorías a la vez.
  // Los filtros llegan como slugs (`filtros-tienda.ts`) y se cruzan por
  // slug, que es único en las tres tablas. Una subconsulta y no un JOIN: el
  // de categoría y el de color no agregan columnas, solo recortan.
  //
  // La categoría de la página (F3.11) recorta igual que el filtro: es la
  // misma condición con otro origen.
  const categorias = f.seccion ? [f.seccion] : f.categoria;
  if (categorias.length) {
    partes.push(sql`p.category_id IN (
      SELECT id FROM categories WHERE ${losSlugs(sql`slug`, categorias)})`);
  }
  if (f.marca.length) partes.push(losSlugs(sql`b.slug`, f.marca));

  // RF-02: «muestra el producto si ALGUNA de sus variantes tiene ese color».
  // Por eso es un EXISTS y no un JOIN: con el join, un producto que tiene el
  // color en tres variantes aparecería tres veces en la grilla y contaría tres
  // veces en el total.
  //
  // **Por cualquiera de los dos colores** (2026-10-05): una variante
  // «Negro/Rojo» aparece buscando negro y buscando rojo, que es como la
  // describiría quien la tiene en la mano.
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

  // Sobre el precio FINAL y no sobre `price` (RF-02): quien pone «hasta
  // 20.000» está diciendo cuánto quiere pagar, no cuánto salía antes de la
  // oferta. Los bordes son inclusivos.
  if (f.precioMin !== null) partes.push(sql`p.final_price >= ${f.precioMin}`);
  if (f.precioMax !== null) partes.push(sql`p.final_price <= ${f.precioMax}`);

  if (f.oferta) partes.push(sql`p.discount > 0`);

  return sql.join(partes, sql` AND `);
}

const ORDEN: Record<FiltrosDeTienda["orden"], SQL> = {
  // Destacados arriba y después alfabético, igual que el orden público de las
  // categorías (§10.2). `immutable_unaccent` para que «Ábaco» no caiga al
  // final por su acento.
  relevancia: sql`p.is_featured DESC, immutable_unaccent(lower(p.name))`,
  "precio-asc": sql`p.final_price ASC`,
  "precio-desc": sql`p.final_price DESC`,
  nombre: sql`immutable_unaccent(lower(p.name))`,
  novedades: sql`p.created_at DESC`,
};

/**
 * Lo que la tarjeta necesita de un producto (§6.1), para cualquier pantalla
 * que la dibuje: el catálogo y, desde F5.4, «Favoritos». La tarjeta es SIEMPRE
 * la misma, y dos copias de esta consulta terminarían mostrando dos portadas
 * o dos stocks distintos para el mismo producto.
 *
 * Los dos fragmentos esperan `p` (products) y `b` (brands) en el FROM.
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
  /** Cuántos hay con ESTOS filtros. Decide la paginación y el conteo. */
  total: number;
  /**
   * Cuántos hay en total, sin filtros: en la tienda, o en la categoría de la
   * página. Ver `leerPaginaDelCatalogo`.
   */
  totalSinFiltros: number;
};

/**
 * Una página del catálogo.
 *
 * Devuelve también `totalSinFiltros` porque §8 pide distinguir **vacío** de
 * **sin resultados**: son dos pantallas distintas —«todavía no hay productos»
 * contra «no encontramos nada para “xxx”, probá quitando filtros»— y con un
 * solo número no se pueden separar. Sale de la misma llamada para no obligar a
 * cada pantalla a acordarse de pedirlo.
 */
export async function leerPaginaDelCatalogo(
  f: FiltrosDeTienda,
): Promise<PaginaDelCatalogo> {
  const donde = condiciones(f);
  const desde = (f.pagina - 1) * POR_PAGINA;

  /**
   * Las tres consultas van en paralelo, no una tras otra: son independientes
   * y encadenarlas suma tres viajes a la base donde alcanza con uno.
   */
  const [filas, [conteo], [todos]] = await Promise.all([
    db.execute<FilaDeTarjeta>(sql`
      SELECT ${COLUMNAS_DE_TARJETA}
        FROM products p
        JOIN brands b ON b.id = p.brand_id
        ${UNIONES_DE_TARJETA}
       WHERE ${donde}
       ORDER BY ${ORDEN[f.orden]}, p.id
       LIMIT ${POR_PAGINA} OFFSET ${desde}`),

    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n
        FROM products p
        JOIN brands b ON b.id = p.brand_id
       WHERE ${donde}`),

    // En la página de una categoría (F3.11), «sin filtros» es la categoría
    // entera: «todavía no hay productos» tiene que hablar de esa categoría,
    // no de la tienda.
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

/**
 * Una opción del filtro. Viaja con su `slug` y no con su id: es lo que va en
 * la dirección (`?categoria=teclados`) y lo único que el filtro necesita.
 */
export type OpcionDeFiltro = { slug: string; nombre: string; cuantos: number };

/** Un color además se dibuja, así que viaja con su hexadecimal (§6.5). */
export type OpcionDeColor = OpcionDeFiltro & { hex: string };

/**
 * Las opciones de cada grupo del drawer, con cuántos — RF-02.
 *
 * **Cada grupo se calcula con los filtros de los OTROS grupos, no con los
 * suyos** (2026-11-05, decisión tuya). Con «Teclados» elegido, Marca ofrece
 * solo las marcas que tienen teclados; Categoría sigue ofreciendo todas las
 * que tienen algo con el resto de los filtros, porque dentro del grupo las
 * opciones se suman y ofrecer otra categoría amplía, no recorta. Así ningún
 * chip lleva a un listado vacío. La búsqueda, el precio y la oferta cuentan
 * para todos los grupos.
 *
 * **Lo elegido se ofrece siempre, aunque quede en cero**: una marca elegida
 * que deja de tener productos al sumar un color tiene que seguir en el drawer
 * —y en los chips de arriba de la grilla, que salen de acá— para poder
 * sacarla.
 *
 * **El orden no cambia al filtrar**: las que más productos activos tienen en
 * toda la tienda primero (2026-11-03), las categorías destacadas antes que
 * todo, y a igual número por nombre. Ordenar por el número del momento haría
 * que los chips salten de lugar con cada toque. El drawer muestra las 8
 * primeras de cada grupo, así que el orden decide qué se ve sin abrir nada.
 *
 * **Las puntas del precio** salen con todos los filtros menos el precio:
 * el slider va de lo más barato a lo más caro de lo que se está mirando.
 *
 * **En la página de una categoría** (F3.11) la categoría de la página es un
 * filtro más (`comoFiltroDeCategoria`): recorta marcas, colores y precio, y
 * en el grupo Categoría aparece elegida.
 */
export async function leerOpcionesDeFiltro(
  filtros: FiltrosDeTienda = FILTROS_DE_TIENDA_VACIOS,
): Promise<{
  categorias: OpcionDeFiltro[];
  marcas: OpcionDeFiltro[];
  colores: OpcionDeColor[];
  precios: { min: number; max: number } | null;
  /**
   * Cuántos productos en oferta hay con los demás filtros. Con cero, la
   * casilla «Solo productos en oferta» llevaría a un vacío.
   */
  enOferta: number;
}> {
  const f = comoFiltroDeCategoria(filtros);

  /** Los productos que cuentan para un grupo: los filtros de los demás. */
  const coincidentes = (sinElGrupo: Partial<FiltrosDeTienda>) => sql`
    SELECT p.id, p.category_id, p.brand_id, p.final_price
      FROM products p
      JOIN brands b ON b.id = p.brand_id
     WHERE ${condiciones({ ...f, ...sinElGrupo })}`;

  /** `slug IN (...)` con lo elegido, o falso si no hay nada elegido. */
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

      // `count(DISTINCT x.id)`, no `count(x.id)`: un producto con dos variantes
      // negras se contaría dos veces.
      //
      // El filtro ofrece los colores SUELTOS, nunca «Negro/Rojo»: una variante
      // de dos colores suma en los dos, igual que el filtro la encuentra por
      // cualquiera (arriba, en `condiciones`).
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

      // El precio FINAL, el mismo que mira el filtro, en pesos enteros hacia
      // afuera: así lo más barato y lo más caro siempre quedan adentro.
      db.execute<{ min: number | null; max: number | null }>(sql`
      WITH x AS (${coincidentes({ precioMin: null, precioMax: null })})
      SELECT floor(min(final_price))::int AS min,
             ceil(max(final_price))::int  AS max
        FROM x`),

      // La oferta, como un grupo más (2026-11-05): con los demás filtros y
      // la oferta puesta. Es lo que la casilla mostraría si se la tocara.
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
    // Sin productos o todo al mismo precio no hay nada que deslizar.
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
