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
 * El orden no tiene nada al azar (§11.2): la misma ficha muestra lo mismo en
 * cada recarga, y los tests pueden afirmar qué sale.
 */

/** Una fila de la grilla de escritorio, igual que las secciones de la home. */
export const POR_BLOQUE = 4;

/**
 * Cuántos candidatos se traen por bloque: el doble del cupo, para que los
 * similares sigan llenando su fila después de sacarles los que ya salieron
 * arriba. Con cuatro arriba, en el peor caso se pierden cuatro y quedan
 * cuatro.
 */
const CANDIDATOS = POR_BLOQUE * 2;

export type Recomendados = {
  complementos: ProductoEnTarjeta[];
  similares: ProductoEnTarjeta[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Lo común a todos los bloques: excluir lo que ya se está mirando y los
 * inactivos, y el orden de RF-32 —con stock, nivel, prioridad, destacados,
 * más nuevos—.
 *
 * `base` son las tablas de partida del `WITH`, y tiene que definir `fuera`
 * (los productos que no se recomiendan): en la ficha, `a` con el producto que
 * se está viendo; en el carrito, `carrito` con lo que ya está adentro.
 * `candidatos` es una subconsulta con `id`, `nivel`, `prioridad` y
 * `solo_con_stock` que lee de esa base.
 */
function recomendar(
  ejecutor: Tx | typeof db,
  base: SQL,
  candidatos: SQL,
  cupo: number,
) {
  return ejecutor.execute<FilaDeTarjeta>(sql`
    WITH ${base}
    SELECT ${COLUMNAS_DE_TARJETA}
      FROM (${candidatos}) x
      JOIN products p ON p.id = x.id
      JOIN brands b   ON b.id = p.brand_id
      ${UNIONES_DE_TARJETA}
     WHERE p.is_active
       AND p.id NOT IN (SELECT id FROM fuera)
       AND (NOT x.solo_con_stock OR st.disponible > 0)
     ORDER BY st.disponible > 0 DESC,
              x.nivel, x.prioridad,
              p.is_featured DESC, p.created_at DESC, p.id
     LIMIT ${cupo}`);
}

/** La base de la ficha: el producto que se está viendo. */
function delProducto(productoId: string): SQL {
  return sql`
    a AS (
      SELECT id, category_id, brand_id, final_price
        FROM products
       WHERE id = ${productoId}
    ),
    fuera AS (SELECT id FROM a)`;
}

/**
 * Nivel 1, las relacionadas, con el `sort_order` de la relación como
 * prioridad. Nivel 2, los destacados con stock **de otra categoría**.
 *
 * «De otra categoría» no está en RF-32 y es a propósito: un destacado de la
 * misma categoría es un similar, no un complemento —en la ficha de un teclado,
 * otro teclado no es «algo que necesito junto con esto»—. Sin esta condición,
 * como el bloque de arriba se llena primero, se lo quitaría al de similares,
 * que es donde va.
 */
const COMPLEMENTOS = sql`
  SELECT p.id,
         CASE WHEN cr.category_id IS NOT NULL THEN 1 ELSE 2 END AS nivel,
         coalesce(cr.sort_order, 0) AS prioridad,
         cr.category_id IS NULL AS solo_con_stock
    FROM a
    JOIN products p ON true
    LEFT JOIN category_relations cr
      ON cr.category_id = a.category_id
     AND cr.related_category_id = p.category_id
   WHERE cr.category_id IS NOT NULL
      OR (p.is_featured AND p.category_id <> a.category_id)`;

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
         0 AS prioridad,
         false AS solo_con_stock
    FROM a
    JOIN products p
      ON p.category_id = a.category_id
      OR p.brand_id = a.brand_id`;

export async function leerRecomendados(
  productoId: string,
  ejecutor: Tx | typeof db = db,
): Promise<Recomendados> {
  const [complementos, similares] = await Promise.all([
    recomendar(ejecutor, delProducto(productoId), COMPLEMENTOS, CANDIDATOS),
    recomendar(ejecutor, delProducto(productoId), SIMILARES, CANDIDATOS),
  ]);

  // Un producto no sale dos veces en la misma pantalla (RF-32). El de arriba
  // se queda con el suyo: para que un complemento se repita abajo tiene que
  // ser de la misma marca y de una categoría relacionada, y ahí es más
  // complemento que alternativa.
  const arriba = complementos.slice(0, POR_BLOQUE);
  const yaSalieron = new Set(arriba.map((p) => p.id));

  return {
    complementos: arriba.map(aTarjeta),
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
 * con esto?— con el carrito entero como punto de partida: los productos de
 * las categorías relacionadas con CUALQUIERA de las de adentro y, si no
 * alcanza, los destacados con stock. Una categoría relacionada con dos de las
 * del carrito toma la mejor de sus dos posiciones.
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
  ejecutor: Tx | typeof db = db,
): Promise<ProductoEnTarjeta[]> {
  if (variantes.length === 0) return [];

  const base = sql`
    carrito AS (
      SELECT DISTINCT p.id, p.category_id
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
       WHERE ${enLaLista(sql`v.id`, variantes)}
    ),
    fuera AS (SELECT id FROM carrito)`;

  const candidatos = sql`
    SELECT p.id,
           CASE WHEN r.prioridad IS NOT NULL THEN 1 ELSE 2 END AS nivel,
           coalesce(r.prioridad, 0) AS prioridad,
           r.prioridad IS NULL AS solo_con_stock
      FROM products p
      LEFT JOIN (
        SELECT cr.related_category_id, min(cr.sort_order) AS prioridad
          FROM category_relations cr
         WHERE cr.category_id IN (SELECT category_id FROM carrito)
         GROUP BY cr.related_category_id
      ) r ON r.related_category_id = p.category_id
     WHERE (r.prioridad IS NOT NULL OR p.is_featured)
       AND p.category_id NOT IN (SELECT category_id FROM carrito)`;

  const filas = await recomendar(ejecutor, base, candidatos, POR_BLOQUE);
  return filas.map(aTarjeta);
}
