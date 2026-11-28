import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { ZONA_HORARIA } from "@/lib/fechas";
import type { Money } from "@/lib/money";
import { contarBajasPendientes } from "@/modules/users/baja/operaciones";

// Cada número tiene que coincidir con el listado filtrado al que enlaza
// (RF-14): el mes se recorta acá y el listado recibe la misma fecha.

/**
 * No `date_trunc('month', now())` a secas: el contenedor corre en UTC, y las
 * ventas de las tres primeras horas del mes caerían en el anterior.
 */
const INICIO_DEL_MES = sql`
  (date_trunc('month', now() AT TIME ZONE ${ZONA_HORARIA}))::timestamp
    AT TIME ZONE ${ZONA_HORARIA}`;

export type ParaHacer = {
  ordenesActivas: number;
  /** En el umbral de RF-20 o por debajo, el cero incluido. */
  paraReponer: number;
  /** De esos, cuántos ya están en cero. */
  sinStock: number;
  bajasPedidas: number;
};

export async function loQueHayParaHacer(
  umbralDeStockBajo: number,
): Promise<ParaHacer> {
  const [ordenes, stock, bajas] = await Promise.all([
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM orders WHERE status = 'activa'`),
    contarStockParaReponer(umbralDeStockBajo),
    contarBajasPendientes(),
  ]);

  return {
    ordenesActivas: ordenes[0].n,
    paraReponer: stock.paraReponer,
    sinStock: stock.sinStock,
    bajasPedidas: bajas,
  };
}

/**
 * Se agrupa por producto antes de contar: por variante, un color agotado haría
 * «sin stock» a un producto que tiene otro con diez. La expresión es la misma
 * que la del listado de productos, para que los números coincidan.
 */
async function contarStockParaReponer(
  umbral: number,
): Promise<{ paraReponer: number; sinStock: number }> {
  const [fila] = await db.execute<{
    paraReponer: number;
    sinStock: number;
  }>(sql`
    SELECT count(*)::int                                  AS "paraReponer",
           count(*) FILTER (WHERE disponible <= 0)::int    AS "sinStock"
      FROM (
        SELECT COALESCE(sum(v.stock_total - v.reserved_stock), 0) AS disponible
          FROM products p
          LEFT JOIN product_variants v ON v.product_id = p.id
         WHERE p.is_active
         GROUP BY p.id
      ) AS por_producto
     WHERE disponible <= ${umbral}`);

  return fila;
}

export type ElMes = {
  /** Neto de devoluciones (RF-28). */
  vendido: Money;
  ordenes: number;
  productosActivos: number;
  /** `AAAA-MM-DD` del 1°, para que el enlace abra el mismo recorte. */
  desde: string;
};

/**
 * La misma definición de vendido que Reportes (TECHNICAL-SPEC §15). Supone que
 * `orders.total` es igual a la suma de sus renglones: si no, la resta mezcla
 * dos cosas (pasa en la base de desarrollo, con escenarios de `total` en cero).
 * Puede dar negativo de verdad: un mes flojo con una devolución grande.
 */
export async function comoVieneElMes(): Promise<ElMes> {
  const [fila] = await db.execute<ElMes>(sql`
    WITH mes AS (SELECT ${INICIO_DEL_MES} AS inicio)
    SELECT (
             COALESCE((SELECT sum(o.total)
                         FROM orders o CROSS JOIN mes
                        WHERE o.status = 'finalizada'
                          AND o.finalized_at >= mes.inicio), 0)
           - COALESCE((SELECT sum(ri.quantity * oi.unit_price)
                         FROM returns r
                         JOIN return_items ri ON ri.return_id = r.id
                         JOIN order_items  oi ON oi.id = ri.order_item_id
                         CROSS JOIN mes
                        WHERE r.status = 'registrada'
                          AND r.created_at >= mes.inicio), 0)
           )::text AS vendido,
           (SELECT count(*)::int
              FROM orders o CROSS JOIN mes
             WHERE o.status = 'finalizada'
               AND o.finalized_at >= mes.inicio) AS ordenes,
           (SELECT count(*)::int FROM products WHERE is_active)
             AS "productosActivos",
           to_char((SELECT inicio FROM mes) AT TIME ZONE ${ZONA_HORARIA},
                   'YYYY-MM-DD') AS desde
      FROM mes`);

  return fila;
}
