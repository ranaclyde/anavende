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

// RF-32 y TECHNICAL-SPEC §11.2. Cada bloque es una sola consulta: la cascada
// es un orden (nivel), no una serie de consultas. El stock manda sobre el
// nivel: un agotado del nivel 1 no le gana a uno con stock del 2.

export const POR_BLOQUE = 4;

export const MAXIMO_POR_BLOQUE = 8;

export type CategoriaRelacionada = { id: string; slug: string; nombre: string };

export type Complementos = {
  productos: ProductoEnTarjeta[];
  /** Las relacionadas activas, para «Ver todo». Vacío si no hay ninguna. */
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
 * `base` son las tablas del `WITH` y tiene que definir `fuera`. `candidatos`
 * trae `id`, `nivel`, `grupo`, `prioridad` y `solo_con_stock`.
 *
 * El `row_number()` es la vuelta dentro del `grupo`: ordenar por ella antes
 * que por prioridad reparte el bloque entre las relacionadas.
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
 * La base tiene que definir además `relacionadas` (`category_id`, `prioridad`)
 * y `propias` (`id`). Los destacados del nivel 2 son de otra categoría: uno de
 * la misma es una alternativa, no un complemento.
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

  // Una por relacionada que aportó algo, entre cuatro y ocho.
  const aportan = new Set(
    filas.flatMap((f) => (f.nivel === 1 && f.grupo ? [f.grupo] : [])),
  ).size;
  const cupo = Math.min(MAXIMO_POR_BLOQUE, Math.max(POR_BLOQUE, aportan));

  return {
    productos: filas.slice(0, cupo).map(aTarjeta),
    categorias: [...categorias],
  };
}

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
    // De más, para que después de sacar los repetidos queden cuatro si los hay.
    recomendar(ejecutor, base, SIMILARES, MAXIMO_POR_BLOQUE + POR_BLOQUE),
  ]);

  // Un producto no sale dos veces en la pantalla; el bloque de arriba se lo queda.
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
 * «Completá tu setup». Excluye las categorías que ya están en el carrito, en
 * todos los niveles. Hay que pasarle todas las variantes del carrito, también
 * las que ya no se venden: siguen a la vista en «Ya no disponible».
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
