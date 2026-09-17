import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { ZONA_HORARIA } from "@/lib/fechas";
import type { Money } from "@/lib/money";
import { contarBajasPendientes } from "@/modules/users/baja/operaciones";

/**
 * Los números del inicio del panel — FS RF-14 · DR §6.9. Tarea F7.8.
 *
 * **Contesta dos preguntas distintas, y por eso son dos lecturas y no una
 * lista de indicadores.** «¿Qué tengo que hacer hoy?» es lo que la vendedora
 * viene a buscar al abrir el panel (pedido tuyo del 2026-09-14), y «¿cómo
 * viene el mes?» es otra cosa: mirar, no hacer. Mezcladas, el mismo número
 * aparecía dos veces —las órdenes activas y el stock bajo están en las dos
 * listas de RF-14— y ninguna de las dos preguntas quedaba contestada.
 *
 * **Todo se cuenta en SQL** (§7.1), y las lecturas son independientes: la
 * pantalla las pide en paralelo. Ninguna trae filas, solo números, así que un
 * catálogo grande no cambia lo que cuesta abrir esta pantalla.
 *
 * **Cada número viaja con el filtro que lo reproduce.** Es lo que RF-14 pide
 * —«cada indicador enlaza al listado filtrado correspondiente»— y lo que
 * impide la traición clásica del tablero: el que dice 5 y abre un listado de
 * 7. El mes se recorta acá y el listado recibe la misma fecha.
 */

/**
 * El primer instante del mes en curso, en la zona del negocio.
 *
 * **No es `date_trunc('month', now())` a secas**: el contenedor corre en UTC,
 * así que el 1° a las 00:00 de acá es el 1° a las 03:00 en UTC, y las ventas
 * de las tres primeras horas del mes caerían en el mes anterior. Es el mismo
 * cuidado que el rango del listado de órdenes (F7.1), que ya paga esa lección.
 */
const INICIO_DEL_MES = sql`
  (date_trunc('month', now() AT TIME ZONE ${ZONA_HORARIA}))::timestamp
    AT TIME ZONE ${ZONA_HORARIA}`;

export type ParaHacer = {
  /** Órdenes `activa`: lo que hay que preparar y entregar (RF-21). */
  ordenesActivas: number;
  /** Productos en el umbral de RF-20 o por debajo, el cero incluido. */
  paraReponer: number;
  /** De esos, cuántos ya están en cero: es lo urgente de lo mismo. */
  sinStock: number;
  /** Bajas de cuenta pedidas y sin ejecutar (RF-34, F7.9). */
  bajasPedidas: number;
};

/**
 * Lo que espera que alguien lo atienda.
 *
 * **Los tres son «todavía no pasó»**, no estadísticas: una orden activa es una
 * entrega pendiente, un producto para reponer es una compra pendiente y una
 * baja pedida es una decisión pendiente. Por eso van juntos aunque vengan de
 * tres tablas distintas.
 */
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
 * Cuántos productos hay que reponer, y cuántos de ésos están en cero.
 *
 * **Se agrupa primero y se cuenta después**: el stock disponible de un
 * producto es la suma de sus variantes, así que preguntarlo variante por
 * variante contaría como «sin stock» a un producto que tiene un color agotado
 * y otro con diez. Es la misma razón por la que el listado de productos usa
 * `HAVING` y no `WHERE` (F2.4), y la expresión es la misma para que los dos
 * números coincidan con lo que el listado va a mostrar.
 *
 * **Solo los activos.** Un producto apagado no se vende, así que reponerlo no
 * es trabajo de hoy; y el enlace lleva al listado con ese mismo filtro, para
 * que el número y lo que se abre digan lo mismo.
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
  /** Facturado neto de devoluciones (RF-28). */
  vendido: Money;
  /** Cuántas órdenes se finalizaron. */
  ordenes: number;
  /** Productos activos en el catálogo: el tamaño de lo que está a la venta. */
  productosActivos: number;
  /** `AAAA-MM-DD` del 1°, para que el enlace abra el mismo recorte. */
  desde: string;
};

/**
 * Cómo viene el mes.
 *
 * **El vendido es el de RF-28: solo `finalizada`, y neto de devoluciones.** Un
 * número bruto acá y uno neto en Reportes (F9.1) serían dos verdades distintas
 * para la misma pregunta, y la que se mira todos los días es ésta. Las activas
 * no cuentan porque todavía pueden cancelarse, y las canceladas nunca fueron
 * una venta.
 *
 * **Se corta por `finalized_at` y no por `created_at`**: la venta ocurre
 * cuando se entrega, no cuando se cargó el pedido. Una orden de fin de mes que
 * se finaliza el 3 es una venta de este mes, y contarla en el anterior movería
 * plata de un mes a otro sin que nadie lo tocara.
 *
 * **Las devoluciones restan en el mes en que se registraron**, que es lo que
 * RF-28 decide, y no en el de la orden devuelta. Las anuladas no restan: una
 * devolución anulada es una que no ocurrió.
 *
 * **Las dos mitades de la resta miden lo mismo**: se suma `orders.total`, que
 * todo camino de escritura deja igual a `SUM(order_items.subtotal)` —crear,
 * cargar a mano y editar lo recalculan en SQL—, y lo devuelto sale de los
 * precios de esos mismos renglones. Si un día `total` dejara de mantenerse,
 * esta cuenta restaría peras de manzanas y daría negativo sin que nada falle:
 * pasa hoy en la base de desarrollo, donde los escenarios de prueba insertan
 * órdenes con el `total` en cero.
 *
 * **Y puede dar negativo de verdad**, sin que nada esté roto: un mes flojo con
 * una devolución grande es exactamente eso. Se muestra como viene.
 *
 * Todo en una sola consulta y en SQL: los montos son `numeric` y sumarlos en
 * JavaScript es justo lo que §7.1 prohíbe.
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
