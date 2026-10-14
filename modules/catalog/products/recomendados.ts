import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { ProductoEnTarjeta } from "@/components/shop/tarjeta-producto";
import {
  aTarjeta,
  COLUMNAS_DE_TARJETA,
  enLaLista,
  UNIONES_DE_TARJETA,
  type FilaDeTarjeta,
} from "@/modules/catalog/products/tienda";

/**
 * Los recomendados de la ficha — F8.2, RF-32, TS §11.2. Al final del archivo,
 * «Completá tu setup» del carrito (F8.3), con la misma cascada.
 *
 * Dos bloques que no se mezclan, porque responden dos preguntas distintas:
 *
 *   · **«También te puede interesar»** (`complementos`): ¿qué más necesito
 *     junto con esto? Primero los productos de las categorías relacionadas
 *     (RF-31, F8.1), en el orden que les dio la vendedora; si no alcanza,
 *     los destacados con stock.
 *   · **«Productos similares»** (`similares`): ¿hay algo parecido que me
 *     convenga más? Misma categoría con el precio final a ±30%, después la
 *     misma categoría a cualquier precio, después la misma marca.
 *
 * **La cascada es un orden y no una serie de consultas.** Cada bloque es UNA
 * consulta que le pone a cada candidato su nivel y ordena por él: «recorrer
 * las fuentes hasta llenar el cupo» es exactamente eso, sin un viaje a la
 * base por nivel ni un «¿faltan?» entre medio. Y los dos bloques salen en
 * paralelo.
 *
 * **El stock manda sobre el nivel.** RF-32: «los agotados sólo se usan si no
 * alcanza el cupo». Por eso el orden empieza por «tiene stock» y recién
 * después mira el nivel: un similar de la misma marca que se puede comprar
 * pasa adelante de uno de la misma categoría que no. El SQL de §11.2 ordenaba
 * el stock adentro de cada nivel, y así un agotado del nivel 1 le ganaba el
 * lugar a un destacado con stock del 2; manda la especificación funcional.
 *
 * **Sin inactivos por construcción.** `p.is_active` filtra el producto, y una
 * categoría relacionada que se desactivó no aporta nada sin que haga falta
 * mirarla: RN-11b no deja productos activos en una categoría inactiva
 * (`tienda.ts` explica por qué no se repite la condición).
 *
 * **Uno de cada relacionada, por vueltas** (pedido del 2026-10-14). Los
 * complementos no se ordenan «todos los de la primera relacionada, después
 * los de la segunda»: con Mouses primera y seis mouses, el bloque era cuatro
 * mouses y Micrófonos y Teclados no aparecían nunca. Se reparten por vueltas
 * —el mejor de cada relacionada en su orden, después el segundo de cada una—,
 * y el cupo crece con las relacionadas: cuatro como mínimo, que con tres
 * relacionadas es un segundo producto de la primera, y una por relacionada
 * hasta ocho, el tope de RF-32. Con más de cuatro, el bloque se desliza.
 *
 * El orden no tiene nada al azar (§11.2): la misma ficha muestra lo mismo en
 * cada recarga, y los tests pueden afirmar qué sale.
 */

/** Una fila de la grilla de escritorio, igual que las secciones de la home. */
export const POR_BLOQUE = 4;

/**
 * El tope de RF-32 («entre 4 y 8 por bloque»). Los complementos llegan acá
 * cuando hay ocho relacionadas o más: una por relacionada.
 */
export const MAXIMO_POR_BLOQUE = 8;

/** Una categoría relacionada, para el «Ver todo» del bloque. */
export type CategoriaRelacionada = { id: string; slug: string; nombre: string };

/** Un bloque de complementos: lo que se muestra y de dónde sale. */
export type Complementos = {
  productos: ProductoEnTarjeta[];
  /**
   * Las relacionadas activas, en su orden, para «Ver todo»: el catálogo con
   * todas filtradas. Vacío si no hay ninguna —entonces el bloque es de
   * destacados y no hay un listado que lo continúe—.
   */
  categorias: CategoriaRelacionada[];
};

export type Recomendados = {
  complementos: Complementos;
  similares: ProductoEnTarjeta[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ejecutor = Tx | typeof db;

type FilaRecomendada = FilaDeTarjeta & {
  nivel: number;
  grupo: string | null;
};

/**
 * Lo común a todos los bloques: excluir lo que ya se está mirando y los
 * inactivos, y el orden de RF-32 —con stock, nivel, vuelta, prioridad,
 * destacados, más nuevos—.
 *
 * `base` son las tablas de partida del `WITH`, y tiene que definir `fuera`
 * (los productos que no se recomiendan): en la ficha, `a` con el producto que
 * se está viendo; en el carrito, `carrito` con lo que ya está adentro.
 * `candidatos` es una subconsulta con `id`, `nivel`, `grupo`, `prioridad` y
 * `solo_con_stock` que lee de esa base.
 *
 * **La vuelta** es el puesto de cada candidato dentro de su `grupo`: el
 * primero de cada relacionada es la vuelta 1, el segundo la 2. Ordenar por
 * vuelta antes que por prioridad es lo que reparte el bloque entre las
 * relacionadas. Sin grupo —similares, destacados— todo el nivel es un solo
 * grupo y la vuelta no cambia nada.
 */
function recomendar(
  ejecutor: Ejecutor,
  base: SQL,
  candidatos: SQL,
  cupo: number,
) {
  return ejecutor.execute<FilaRecomendada>(sql`
    WITH ${base}
    SELECT ${COLUMNAS_DE_TARJETA},
           x.nivel,
           x.grupo
      FROM (${candidatos}) x
      JOIN products p ON p.id = x.id
      JOIN brands b   ON b.id = p.brand_id
      ${UNIONES_DE_TARJETA}
     WHERE p.is_active
       AND p.id NOT IN (SELECT id FROM fuera)
       AND (NOT x.solo_con_stock OR st.disponible > 0)
     ORDER BY st.disponible > 0 DESC,
              x.nivel,
              row_number() OVER (
                PARTITION BY x.nivel, x.grupo
                ORDER BY st.disponible > 0 DESC, p.is_featured DESC,
                         p.created_at DESC, p.id
              ),
              x.prioridad,
              p.is_featured DESC, p.created_at DESC, p.id
     LIMIT ${cupo}`);
}

/**
 * Los complementos, para la ficha y el carrito: la base tiene que definir
 * además `relacionadas` (`category_id`, `prioridad`) y `propias` (`id`, las
 * categorías que no se completan con destacados).
 *
 * Nivel 1, los productos de las relacionadas, agrupados por categoría. Nivel
 * 2, los destacados con stock **de otra categoría**: en la ficha de un
 * teclado, otro teclado es una alternativa y no un complemento —va a
 * similares—, y en el carrito, con un mouse adentro, otro mouse no completa
 * nada.
 */
async function complementos(
  ejecutor: Ejecutor,
  base: SQL,
): Promise<Complementos> {
  const [filas, categorias] = await Promise.all([
    recomendar(
      ejecutor,
      base,
      sql`
        SELECT p.id,
               CASE WHEN r.category_id IS NOT NULL THEN 1 ELSE 2 END AS nivel,
               r.category_id AS grupo,
               coalesce(r.prioridad, 0) AS prioridad,
               r.category_id IS NULL AS solo_con_stock
          FROM products p
          LEFT JOIN relacionadas r ON r.category_id = p.category_id
         WHERE r.category_id IS NOT NULL
            OR (p.is_featured AND p.category_id NOT IN (SELECT id FROM propias))`,
      MAXIMO_POR_BLOQUE,
    ),
    ejecutor.execute<CategoriaRelacionada>(sql`
      WITH ${base}
      SELECT c.id, c.slug, c.name AS nombre
        FROM relacionadas r
        JOIN categories c ON c.id = r.category_id
       WHERE c.is_active
       ORDER BY r.prioridad, immutable_unaccent(lower(c.name))`),
  ]);

  // Una por relacionada que aportó algo, entre cuatro y ocho. Con tres, la
  // cuarta es la vuelta 2 de la primera, que es lo que sigue en el orden.
  const aportan = new Set(
    filas.flatMap((f) => (f.nivel === 1 && f.grupo ? [f.grupo] : [])),
  ).size;
  const cupo = Math.min(MAXIMO_POR_BLOQUE, Math.max(POR_BLOQUE, aportan));

  return {
    productos: filas.slice(0, cupo).map(aTarjeta),
    categorias: [...categorias],
  };
}

/** La base de la ficha: el producto que se está viendo y sus relacionadas. */
function delProducto(productoId: string): SQL {
  return sql`
    a AS (
      SELECT id, category_id, brand_id, final_price
        FROM products
       WHERE id = ${productoId}
    ),
    fuera AS (SELECT id FROM a),
    propias AS (SELECT category_id AS id FROM a),
    relacionadas AS (
      SELECT cr.related_category_id AS category_id,
             cr.sort_order AS prioridad
        FROM category_relations cr
        JOIN a ON a.category_id = cr.category_id
    )`;
}

/**
 * Nivel 1, misma categoría y precio final dentro de ±30%; nivel 2, misma
 * categoría; nivel 3, misma marca. Las tres sobre el precio FINAL, que es el
 * que paga quien compara (RF-02 usa el mismo para filtrar).
 */
const SIMILARES = sql`
  SELECT p.id,
         CASE
           WHEN p.category_id = a.category_id
            AND p.final_price BETWEEN a.final_price * 0.7
                                  AND a.final_price * 1.3 THEN 1
           WHEN p.category_id = a.category_id               THEN 2
           ELSE 3
         END AS nivel,
         NULL::uuid AS grupo,
         0 AS prioridad,
         false AS solo_con_stock
    FROM a
    JOIN products p
      ON p.category_id = a.category_id
      OR p.brand_id = a.brand_id`;

export async function leerRecomendados(
  productoId: string,
  ejecutor: Ejecutor = db,
): Promise<Recomendados> {
  const base = delProducto(productoId);
  const [arriba, similares] = await Promise.all([
    complementos(ejecutor, base),
    // Los que pueden salir arriba, más una fila: después de sacar los
    // repetidos, siempre quedan cuatro si los hay.
    recomendar(ejecutor, base, SIMILARES, MAXIMO_POR_BLOQUE + POR_BLOQUE),
  ]);

  // Un producto no sale dos veces en la misma pantalla (RF-32). El de arriba
  // se queda con el suyo: para que un complemento se repita abajo tiene que
  // ser de la misma marca y de una categoría relacionada, y ahí es más
  // complemento que alternativa.
  const yaSalieron = new Set(arriba.productos.map((p) => p.id));

  return {
    complementos: arriba,
    similares: similares
      .filter((p) => !yaSalieron.has(p.id))
      .slice(0, POR_BLOQUE)
      .map(aTarjeta),
  };
}

/**
 * «Completá tu setup», el bloque del carrito — F8.3, RF-32, DR §7.4.
 *
 * Es la intención de «También te puede interesar» —¿qué más necesito junto
 * con esto?— con el carrito entero como punto de partida, y con las mismas
 * vueltas: las relacionadas con CUALQUIERA de las categorías de adentro —una
 * relacionada con dos toma la mejor de sus dos posiciones— y, si no alcanza,
 * los destacados con stock.
 *
 * **Nada de las categorías que ya están en el carrito**, en ningún nivel. RF-32
 * pide excluir los productos, y esto va un paso más: «completar» es sumar lo
 * que falta, y con un mouse adentro, otro mouse no completa nada —aunque
 * Mouses sea relacionada de Teclados y haya un teclado al lado—.
 *
 * Recibe las variantes y no los productos porque es lo que tiene el carrito;
 * se le pasan **todas**, también las que ya no se venden: siguen a la vista
 * en «Ya no disponible», y recomendar el mismo producto ahí abajo sería
 * ofrecer lo que la pantalla acaba de decir que no hay. Sin variantes no hay
 * bloque (RF-32: con el carrito vacío no se muestra).
 */
export async function leerCompletaTuSetup(
  variantes: readonly string[],
  ejecutor: Ejecutor = db,
): Promise<Complementos> {
  if (variantes.length === 0) return { productos: [], categorias: [] };

  return complementos(
    ejecutor,
    sql`
      carrito AS (
        SELECT DISTINCT p.id, p.category_id
          FROM product_variants v
          JOIN products p ON p.id = v.product_id
         WHERE ${enLaLista(sql`v.id`, variantes)}
      ),
      fuera AS (SELECT id FROM carrito),
      propias AS (SELECT DISTINCT category_id AS id FROM carrito),
      relacionadas AS (
        SELECT cr.related_category_id AS category_id,
               min(cr.sort_order) AS prioridad
          FROM category_relations cr
         WHERE cr.category_id IN (SELECT id FROM propias)
           AND cr.related_category_id NOT IN (SELECT id FROM propias)
         GROUP BY cr.related_category_id
      )`,
  );
}
