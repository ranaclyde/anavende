import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  POR_PAGINA,
  type EstadoDeProductos,
  type FiltrosDeProductos,
} from "@/modules/catalog/products/filtros";

/**
 * Lecturas de productos para el panel — RF-15.
 *
 * El listado sale de UNA consulta: los tres números de stock son agregados
 * de las variantes en el mismo `LEFT JOIN` que ya estaba, y los filtros y el
 * orden se resuelven en la base. Traer los productos y después sumarles el
 * stock en JavaScript sería N+1 en la pantalla que más se usa del panel, y
 * ordenar por stock ya no podría hacerse sin traerlos todos.
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
  /** Comprometido por órdenes activas (RN-07). */
  reservado: number;
  /** `stockTotal − reservado` (§8.1). Es el número que puede venderse. */
  disponible: number;
  variantes: number;
  /**
   * Variantes con el total en negativo. No es lo mismo que «sin stock»: un
   * negativo lo PRODUCE una venta ya registrada sobre unidades que el
   * sistema no tenía (RF-24), así que es una discrepancia a corregir y §5.4
   * pide que el panel la destaque. Se cuenta por variante porque una en −3
   * y otra en +10 suman 7: en el total no se vería.
   */
  variantesEnNegativo: number;
};

/**
 * Los comodines de `ILIKE` se escapan antes de entrar a la consulta.
 *
 * Sin esto, buscar «50%» traería todo y «USB_C» encontraría «USB-C» y
 * cualquier otra cosa con una letra en el medio: el término dejaría de
 * significar lo que dice.
 */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

/**
 * La búsqueda del panel es la MITAD por subcadena de §10.1, sin la mitad por
 * similitud de trigramas.
 *
 * No es un recorte por comodidad: son dos preguntas distintas. El comprador
 * tantea —«lojitech»— y agradece que le acerquen algo; la vendedora busca
 * algo que sabe que existe, y un resultado parecido traído por un umbral que
 * todavía no se calibró (F3.3) le esconde el producto que fue a buscar entre
 * otros que no pidió. El `unaccent` sí está: «mecanico» tiene que encontrar
 * «Mecánico» en las dos pantallas.
 */
function condicionDeBusqueda(q: string): SQL {
  const termino = sql`immutable_unaccent(lower(${escaparComodines(q)}))`;
  return sql`(
       immutable_unaccent(lower(p.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(b.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.description_text)) ILIKE '%' || ${termino} || '%'
  )`;
}

/** El stock disponible del producto, tal como lo calcula el SELECT. */
const DISPONIBLE = sql`COALESCE(sum(v.stock_total - v.reserved_stock), 0)`;

/**
 * El listado, y cuántos coinciden con los filtros.
 *
 * **El total es el de los filtros puestos, no el de la página.** Con
 * paginación `productos.length` es el tamaño de la página, así que ya no sirve
 * para el contador de la barra («12 de 26 productos»): ese número es éste. El
 * total SIN filtros es otra cosa y lo da `contarProductos()`, que es lo que
 * separa «todavía no cargaste ninguno» de «ninguno coincide».
 *
 * **El conteo va por subconsulta y no por `count(*)` a secas** porque el
 * filtro de stock vive en un `HAVING` sobre una suma: hay que contar las
 * filas YA agrupadas, no las de `products`.
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

  // El filtro de stock mira una SUMA, así que va en HAVING y no en WHERE:
  // en WHERE se evaluaría variante por variante, y un producto con un color
  // en cero y otro con diez aparecería como «sin stock».
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
            : // «Destacados primero» es una bandera, no una escala: darla
              // vuelta pondría lo NO destacado arriba, que no es un orden que
              // alguien quiera. Por eso ignora la dirección.
              sql`p.is_featured DESC`;

  // Las mismas junturas que el SELECT: la búsqueda mira `b.name` y el filtro
  // de stock suma sobre `v`, así que el conteo no puede recortarlas.
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
 * Cuántos productos hay en cada solapa, sin mirar los filtros.
 *
 * El `todos` es además lo que separa «todavía no cargaste ninguno» de
 * «ninguno coincide con lo que buscaste» (§8): las dos pantallas dicen cosas
 * distintas y ofrecen acciones distintas, y sin ese número no se distinguen.
 *
 * **El conteo NO mira los filtros, a propósito**, igual que en órdenes y en
 * usuarios: si cambiara con cada búsqueda, la solapa dejaría de contestar
 * «¿cuántos tengo sin publicar?» para pasar a ser un resultado más (§6.9).
 *
 * **Acá los tres sí suman**, al revés que en usuarios: activo e inactivo son
 * una partición —`is_active` es un booleano y no admite un producto que esté
 * en las dos—, así que `todos` es la suma de los otros dos.
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
 * Las marcas y categorías del formulario, y del filtro del listado.
 *
 * Vienen TODAS, con su estado, y no solo las activas. Un producto inactivo
 * puede tener marca inactiva —RN-11b prohíbe la combinación activo+inactivo,
 * no la otra—, y si la consulta trajera solo las activas, abrir ese producto
 * mostraría el selector en blanco y guardar le cambiaría la marca sin que
 * nadie lo pidiera. El formulario ofrece las activas y deja ver la que ya
 * está puesta; el filtro las ofrece todas, porque un producto de marca
 * apagada es justamente uno de los que hay que poder encontrar.
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
