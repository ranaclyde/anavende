import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { ProductoEnTarjeta } from "@/components/shop/tarjeta-producto";
import {
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
  return sql`(
       immutable_unaccent(lower(p.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(b.name))             ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.description_text)) ILIKE '%' || ${termino} || '%'
  )`;
}

function condiciones(f: FiltrosDeTienda): SQL {
  const partes: SQL[] = [sql`p.is_active`];

  if (f.q) partes.push(condicionDeBusqueda(f.q));
  if (f.categoria) partes.push(sql`p.category_id = ${f.categoria}`);
  if (f.marca) partes.push(sql`p.brand_id = ${f.marca}`);
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

export type PaginaDelCatalogo = {
  productos: ProductoEnTarjeta[];
  /** Cuántos hay con ESTOS filtros. Decide la paginación y el conteo. */
  total: number;
  /** Cuántos hay en total, sin filtros. Ver `catalogoVacio`. */
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
    db.execute<{
      slug: string;
      nombre: string;
      marca: string;
      precio: string;
      descuento: string;
      precioFinal: string;
      imagenKey: string | null;
      color: string | null;
      disponible: number;
    }>(sql`
      SELECT p.slug,
             p.name            AS nombre,
             b.name            AS marca,
             p.price           AS precio,
             p.discount        AS descuento,
             p.final_price     AS "precioFinal",
             img.storage_key   AS "imagenKey",
             img.color,
             st.disponible
        FROM products p
        JOIN brands b ON b.id = p.brand_id

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
        LEFT JOIN LATERAL (
          SELECT i.storage_key, co.name AS color
            FROM product_variants v
            LEFT JOIN colors co ON co.id = v.color_id
            JOIN variant_images i
              ON i.variant_id = coalesce(v.images_source_id, v.id)
           WHERE v.product_id = p.id AND v.is_active
           ORDER BY i.sort_order, v.id
           LIMIT 1
        ) img ON true

       WHERE ${donde}
       ORDER BY ${ORDEN[f.orden]}, p.id
       LIMIT ${POR_PAGINA} OFFSET ${desde}`),

    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n
        FROM products p
        JOIN brands b ON b.id = p.brand_id
       WHERE ${donde}`),

    db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM products p WHERE p.is_active`,
    ),
  ]);

  return {
    productos: filas.map((r) => ({
      slug: r.slug,
      nombre: r.nombre,
      marca: r.marca,
      precio: r.precio,
      descuento: r.descuento,
      precioFinal: r.precioFinal,
      imagenKey: r.imagenKey,
      color: r.color,
      disponible: r.disponible,
    })),
    total: conteo.n,
    totalSinFiltros: todos.n,
  };
}

export type OpcionDeFiltro = { id: string; nombre: string; cuantos: number };

/**
 * Las marcas y categorías que tienen algo que mostrar, con cuántos.
 *
 * **Solo las que tienen productos activos.** Un filtro que lleva a un listado
 * vacío es una promesa incumplida, y con el catálogo real de Ana —donde va a
 * haber marcas cargadas antes que sus productos— eso pasaría el primer día.
 * El número al lado es lo que evita el clic a ciegas.
 */
export async function leerOpcionesDeFiltro(): Promise<{
  categorias: OpcionDeFiltro[];
  marcas: OpcionDeFiltro[];
}> {
  const [categorias, marcas] = await Promise.all([
    db.execute<OpcionDeFiltro>(sql`
      SELECT c.id, c.name AS nombre, count(p.id)::int AS cuantos
        FROM categories c
        JOIN products p ON p.category_id = c.id AND p.is_active
       GROUP BY c.id
       ORDER BY c.is_featured DESC, immutable_unaccent(lower(c.name))`),

    db.execute<OpcionDeFiltro>(sql`
      SELECT b.id, b.name AS nombre, count(p.id)::int AS cuantos
        FROM brands b
        JOIN products p ON p.brand_id = b.id AND p.is_active
       GROUP BY b.id
       ORDER BY immutable_unaccent(lower(b.name))`),
  ]);

  return { categorias: [...categorias], marcas: [...marcas] };
}
