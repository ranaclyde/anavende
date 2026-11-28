import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { TIME_ZONE } from "@/lib/dates";
import type { Money } from "@/lib/money";
import type { Rango, Ranking } from "@/modules/reports/periodo";

// Qué es una venta y cuándo resta una devolución: TECHNICAL-SPEC §15. Lo de la
// orden suma `orders.total`, como el tablero del inicio; lo del producto suma
// los renglones. Coinciden porque todo camino de escritura deja
// `total = SUM(subtotal)`.

function limites({ desde, hasta }: Rango): { inicio: SQL; fin: SQL } {
  return {
    inicio: sql`((${desde}::date)::timestamp AT TIME ZONE ${TIME_ZONE})`,
    fin: sql`((${hasta}::date + 1)::timestamp AT TIME ZONE ${TIME_ZONE})`,
  };
}

function vendidas(rango: Rango): SQL {
  const { inicio, fin } = limites(rango);
  return sql`
    SELECT o.id, o.origin, o.total, o.finalized_at
      FROM orders o
     WHERE o.status = 'finalizada'
       AND o.finalized_at >= ${inicio}
       AND o.finalized_at <  ${fin}`;
}

/** Los renglones devueltos en el rango, con lo que valían al venderse. */
function devueltos(rango: Rango): SQL {
  const { inicio, fin } = limites(rango);
  return sql`
    SELECT ri.quantity AS unidades,
           ri.quantity * oi.unit_price AS monto,
           oi.variant_id, oi.product_name, oi.brand_name, oi.color_name,
           o.origin, r.created_at
      FROM returns r
      JOIN return_items ri ON ri.return_id = r.id
      JOIN order_items  oi ON oi.id = ri.order_item_id
      JOIN orders       o  ON o.id = oi.order_id
     WHERE r.status = 'registrada'
       AND r.created_at >= ${inicio}
       AND r.created_at <  ${fin}`;
}

export type Totales = {
  /** Neto de devoluciones. Puede dar negativo. */
  vendido: Money;
  devuelto: Money;
  ordenes: number;
  /** Menos las devueltas. */
  unidades: number;
  /**
   * Antes de las devoluciones: una devolución de hoy suele ser de una orden de
   * otro mes, y bajaría el ticket de órdenes que no la tuvieron.
   */
  ticket: Money;
};

export async function totalesDelPeriodo(rango: Rango): Promise<Totales> {
  const [fila] = await db.execute<Totales>(sql`
    WITH vendidas AS (${vendidas(rango)}),
         v AS (SELECT COALESCE(sum(total), 0) AS bruto,
                      count(*)::int           AS ordenes
                 FROM vendidas),
         u AS (SELECT COALESCE(sum(oi.quantity), 0)::int AS unidades
                 FROM order_items oi
                 JOIN vendidas ON vendidas.id = oi.order_id),
         d AS (SELECT COALESCE(sum(monto), 0)         AS monto,
                      COALESCE(sum(unidades), 0)::int AS unidades
                 FROM (${devueltos(rango)}) AS dev)
    SELECT (v.bruto - d.monto)::text                               AS vendido,
           d.monto::text                                           AS devuelto,
           v.ordenes,
           u.unidades - d.unidades                                 AS unidades,
           COALESCE(round(v.bruto / NULLIF(v.ordenes, 0), 2), 0)::text AS ticket
      FROM v, u, d`);

  return fila;
}

export type PuntoDeVentas = {
  /** `AAAA-MM-DD`: el día, o el 1° del mes si se agrupa por mes. */
  fecha: string;
  vendido: Money;
  ordenes: number;
};

/** Con los días sin ventas en cero, para que el gráfico no salte del 3 al 5. */
export async function ventasEnElTiempo(
  rango: Rango,
  agrupado: "dia" | "mes",
): Promise<PuntoDeVentas[]> {
  const unidad = agrupado === "dia" ? "day" : "month";
  const paso = `1 ${unidad}`;

  return [
    ...(await db.execute<PuntoDeVentas>(sql`
      WITH pasos AS (
             SELECT p::date AS dia
               FROM generate_series(date_trunc(${unidad}, ${rango.desde}::timestamp),
                                    ${rango.hasta}::timestamp,
                                    ${paso}::interval) AS p),
           v AS (
             SELECT date_trunc(${unidad}, finalized_at AT TIME ZONE ${TIME_ZONE})::date AS dia,
                    sum(total)       AS monto,
                    count(*)::int    AS ordenes
               FROM (${vendidas(rango)}) AS vendidas
              GROUP BY 1),
           d AS (
             SELECT date_trunc(${unidad}, created_at AT TIME ZONE ${TIME_ZONE})::date AS dia,
                    sum(monto) AS monto
               FROM (${devueltos(rango)}) AS dev
              GROUP BY 1)
      SELECT to_char(pasos.dia, 'YYYY-MM-DD')                        AS fecha,
             (COALESCE(v.monto, 0) - COALESCE(d.monto, 0))::text     AS vendido,
             COALESCE(v.ordenes, 0)                                  AS ordenes
        FROM pasos
        LEFT JOIN v USING (dia)
        LEFT JOIN d USING (dia)
       ORDER BY pasos.dia`)),
  ];
}

/**
 * Con signo: lo devuelto resta. Nombre y marca son los de hoy, con los del
 * renglón de respaldo: la categoría hay que buscarla en el producto, y si no
 * fueran todos al día un producto renombrado saldría en dos filas.
 */
function lineas(rango: Rango): SQL {
  return sql`
    WITH vendidas AS (${vendidas(rango)}),
         l AS (
           SELECT oi.variant_id, oi.product_name, oi.brand_name, oi.color_name,
                  oi.quantity AS unidades, oi.subtotal AS monto
             FROM order_items oi
             JOIN vendidas ON vendidas.id = oi.order_id
           UNION ALL
           SELECT variant_id, product_name, brand_name, color_name,
                  -unidades, -monto
             FROM (${devueltos(rango)}) AS dev)
    SELECT COALESCE(p.id::text, 'pedido:' || l.product_name) AS producto_id,
           COALESCE(p.name, l.product_name)                 AS producto,
           COALESCE(b.id::text, 'pedido:' || l.brand_name)   AS marca_id,
           COALESCE(b.name, l.brand_name)                   AS marca,
           COALESCE(c.id::text, 'sin-categoria')            AS categoria_id,
           COALESCE(c.name, 'Sin categoría')                AS categoria,
           l.color_name                                     AS color,
           l.unidades, l.monto
      FROM l
      LEFT JOIN product_variants v ON v.id = l.variant_id
      LEFT JOIN products   p ON p.id = v.product_id
      LEFT JOIN brands     b ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id`;
}

export type FilaAgrupada = {
  id: string;
  nombre: string;
  unidades: number;
  vendido: Money;
};

/** Sin tope: son decenas. Lo que quedó en cero exacto no se lista. */
export async function ventasAgrupadas(
  rango: Rango,
  por: "categoria" | "marca",
): Promise<FilaAgrupada[]> {
  const id = por === "categoria" ? sql`categoria_id` : sql`marca_id`;
  const nombre = por === "categoria" ? sql`categoria` : sql`marca`;

  return [
    ...(await db.execute<FilaAgrupada>(sql`
      SELECT ${id} AS id,
             ${nombre} AS nombre,
             sum(unidades)::int AS unidades,
             sum(monto)::text   AS vendido
        FROM (${lineas(rango)}) AS lineas
       GROUP BY ${id}, ${nombre}
      HAVING sum(unidades) <> 0 OR sum(monto) <> 0
       ORDER BY sum(monto) DESC, sum(unidades) DESC, ${nombre}`)),
  ];
}

export type ProductoVendido = FilaAgrupada & {
  marca: string;
  /** De mayor a menor. */
  colores: { color: string | null; unidades: number; vendido: Money }[];
};

export const TOPE_DEL_RANKING = 10;

/** Un producto que en el período solo tuvo devoluciones no entra. */
export async function masVendidos(
  rango: Rango,
  ranking: Ranking,
  /** `null` es `LIMIT NULL` en Postgres: sin tope. */
  tope: number | null = TOPE_DEL_RANKING,
): Promise<ProductoVendido[]> {
  const orden =
    ranking === "unidades"
      ? sql`sum(unidades) DESC, sum(monto) DESC`
      : sql`sum(monto) DESC, sum(unidades) DESC`;

  return [
    ...(await db.execute<ProductoVendido>(sql`
      WITH por_color AS (
             SELECT producto_id, producto, marca, color,
                    sum(unidades) AS unidades, sum(monto) AS monto
               FROM (${lineas(rango)}) AS lineas
              GROUP BY producto_id, producto, marca, color)
      SELECT producto_id         AS id,
             producto            AS nombre,
             marca,
             sum(unidades)::int  AS unidades,
             sum(monto)::text    AS vendido,
             json_agg(json_build_object(
                        'color', color,
                        'unidades', unidades::int,
                        'vendido', monto::text)
                      ORDER BY monto DESC, unidades DESC) AS colores
        FROM por_color
       GROUP BY producto_id, producto, marca
      HAVING sum(unidades) > 0
       ORDER BY ${orden}, producto
       LIMIT ${tope}`)),
  ];
}

export type PorOrigen = {
  origen: "web" | "manual";
  vendido: Money;
  ordenes: number;
};

/** Las dos filas salen siempre, aunque una esté en cero. */
export async function webContraManual(rango: Rango): Promise<PorOrigen[]> {
  return [
    ...(await db.execute<PorOrigen>(sql`
      WITH v AS (
             SELECT origin::text AS origen, sum(total) AS monto, count(*)::int AS ordenes
               FROM (${vendidas(rango)}) AS vendidas
              GROUP BY 1),
           d AS (
             SELECT origin::text AS origen, sum(monto) AS monto
               FROM (${devueltos(rango)}) AS dev
              GROUP BY 1)
      SELECT x.origen,
             (COALESCE(v.monto, 0) - COALESCE(d.monto, 0))::text AS vendido,
             COALESCE(v.ordenes, 0)                             AS ordenes
        FROM (VALUES ('web', 1), ('manual', 2)) AS x(origen, orden)
        LEFT JOIN v ON v.origen = x.origen
        LEFT JOIN d ON d.origen = x.origen
       ORDER BY x.orden`)),
  ];
}
