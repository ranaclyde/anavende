import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { ZONA_HORARIA } from "@/lib/fechas";
import type { Money } from "@/lib/money";
import {
  POR_PAGINA,
  type FiltrosDeDevoluciones,
} from "@/modules/returns/filtros";

/**
 * Lecturas de devoluciones para el panel — FS RF-25. Tarea F7.5.
 *
 * Son del panel y de nadie más: no hay ninguna pantalla del comprador que las
 * muestre. Su «Mis compras» sigue diciendo lo que compró (RN-12), y lo que se
 * devolvió se coordina por WhatsApp, como el resto de la posventa.
 *
 * **Los montos salen casteados a `::text`**: `json_build_object` convertiría un
 * `numeric` a número de JavaScript y ahí se pierden centavos (`Money` es una
 * cadena de punta a punta, §6).
 */

export type EstadoDeDevolucion = "registrada" | "anulada";

export type ItemDevuelto = {
  /** El renglón de la orden del que salió, para cruzarlo con la tabla. */
  orderItemId: string;
  nombre: string;
  color: string | null;
  cantidad: number;
  /** `true` volvió al stock; `false` se descartó (RF-25). */
  repone: boolean;
  motivo: string | null;
};

export type Devolucion = {
  id: string;
  estado: EstadoDeDevolucion;
  motivo: string;
  motivoDeAnulacion: string | null;
  /** El nombre del perfil, o `null` si ya no está (`created_by` es `SET NULL`). */
  autor: string | null;
  creadaEn: string;
  anuladaEn: string | null;
  unidades: number;
  /**
   * Lo que esas unidades valían **en esa orden** (RN-12), que es lo que hay que
   * devolverle a quien compró: el precio de hoy puede ser otro.
   */
  monto: Money;
  items: ItemDevuelto[];
};

/** En el listado general, además, de qué orden es y de quién. */
export type DevolucionDelListado = Devolucion & {
  numero: number;
  customerName: string;
};

/**
 * Los ítems de la devolución, con el nombre del snapshot del renglón.
 *
 * Ordenados como los de la orden —producto y color—, así la lista de la
 * devolución se lee contra la tabla de arriba sin ir y venir.
 */
const ITEMS = sql`
  (SELECT coalesce(
            json_agg(
              json_build_object(
                'orderItemId', oi.id,
                'nombre',      oi.product_name,
                'color',       oi.color_name,
                'cantidad',    ri.quantity,
                'repone',      ri.restocks,
                'motivo',      ri.reason
              )
              ORDER BY oi.product_name, oi.color_name
            ),
            '[]'::json)
     FROM return_items ri
     JOIN order_items oi ON oi.id = ri.order_item_id
    WHERE ri.return_id = r.id) AS items`;

const UNIDADES = sql`
  (SELECT coalesce(sum(ri.quantity), 0)::int
     FROM return_items ri
    WHERE ri.return_id = r.id) AS unidades`;

const MONTO = sql`
  (SELECT coalesce(sum(ri.quantity * oi.unit_price), 0)::text
     FROM return_items ri
     JOIN order_items oi ON oi.id = ri.order_item_id
    WHERE ri.return_id = r.id) AS monto`;

const CAMPOS = sql`
  r.id,
  r.status      AS estado,
  r.reason      AS motivo,
  r.void_reason AS "motivoDeAnulacion",
  r.created_at  AS "creadaEn",
  r.voided_at   AS "anuladaEn",
  a.full_name   AS autor,
  ${UNIDADES},
  ${MONTO},
  ${ITEMS}`;

/**
 * Las devoluciones de una orden, de la más nueva a la más vieja.
 *
 * **Por número de orden y no por `id`**, para que la pantalla del detalle la
 * pida **en paralelo** con la orden misma (§rendimiento): pedir primero la
 * orden para sacarle el `id` y recién después las devoluciones sería una
 * cascada en la pantalla que más se abre del panel. Una orden sin devoluciones
 * —que son casi todas— contesta con una lista vacía y no cuesta nada.
 */
export async function devolucionesDeLaOrden(
  numero: number,
): Promise<Devolucion[]> {
  const filas = await db.execute<Devolucion>(sql`
    SELECT ${CAMPOS}
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      LEFT JOIN user_profiles a ON a.id = r.created_by
     WHERE o.order_number = ${numero}
     ORDER BY r.created_at DESC, r.id DESC`);

  return [...filas];
}

/**
 * Cuántas unidades de cada renglón ya se devolvieron, contando **sólo las
 * devoluciones registradas**.
 *
 * Es el mismo criterio del tope de `registrar.ts` (`status = 'registrada'`), y
 * por eso se calcula acá a partir de lo que ya se leyó y no con otra consulta:
 * anular libera el cupo, y dos lugares que cuenten distinto darían una
 * pantalla que ofrece devolver lo que el dominio después rechaza.
 */
export function devueltasPorRenglon(
  devoluciones: readonly Devolucion[],
): Map<string, number> {
  const cuenta = new Map<string, number>();

  for (const devolucion of devoluciones) {
    if (devolucion.estado !== "registrada") continue;
    for (const item of devolucion.items) {
      cuenta.set(
        item.orderItemId,
        (cuenta.get(item.orderItemId) ?? 0) + item.cantidad,
      );
    }
  }

  return cuenta;
}

/**
 * El `WHERE` del listado, compartido por las filas y por el conteo: son dos
 * consultas que tienen que contestar sobre el mismo conjunto.
 *
 * **El rango de fechas incluye el día de `hasta` entero y va `AT TIME ZONE` a
 * la zona del negocio**, por lo mismo que el de órdenes: el servidor corre en
 * UTC, y sin esto una devolución de las 22:00 de un lunes se mostraría como
 * del lunes y se contaría en el martes.
 */
function condiciones(filtros: FiltrosDeDevoluciones): SQL {
  const partes: SQL[] = [];

  if (filtros.estado !== "todas") {
    partes.push(
      sql`r.status = ${filtros.estado === "registradas" ? "registrada" : "anulada"}`,
    );
  }

  // «Con reposición» es la que repone algo, aunque no sea todo; «sin» es la
  // que no repone nada (`filtros.ts`).
  if (filtros.reposicion !== "todas") {
    const reponeAlgo = sql`EXISTS (SELECT 1 FROM return_items ri
                                    WHERE ri.return_id = r.id AND ri.restocks)`;
    partes.push(
      filtros.reposicion === "con" ? reponeAlgo : sql`NOT ${reponeAlgo}`,
    );
  }

  if (filtros.desde) {
    partes.push(sql`r.created_at >=
      (${filtros.desde}::date)::timestamp AT TIME ZONE ${ZONA_HORARIA}`);
  }
  if (filtros.hasta) {
    partes.push(sql`r.created_at <
      (${filtros.hasta}::date + 1)::timestamp AT TIME ZONE ${ZONA_HORARIA}`);
  }

  return partes.length
    ? sql`WHERE ${sql.join(partes, sql` AND `)}`
    : sql`WHERE true`;
}

/**
 * El listado, de la más nueva a la más vieja, y cuántas hay en total.
 *
 * Paginado por lo mismo que las órdenes: las devoluciones se acumulan solas.
 */
export async function listarDevoluciones(
  filtros: FiltrosDeDevoluciones,
): Promise<{ devoluciones: DevolucionDelListado[]; total: number }> {
  const where = condiciones(filtros);

  const [filas, [conteo]] = await Promise.all([
    db.execute<DevolucionDelListado>(sql`
      SELECT ${CAMPOS},
             o.order_number  AS numero,
             o.customer_name AS "customerName"
        FROM returns r
        JOIN orders o ON o.id = r.order_id
        LEFT JOIN user_profiles a ON a.id = r.created_by
        ${where}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ${POR_PAGINA} OFFSET ${(filtros.pagina - 1) * POR_PAGINA}`),
    db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM returns r ${where}`),
  ]);

  return { devoluciones: [...filas], total: conteo.total };
}

/** Si existe alguna devolución, para distinguir «vacío» de «sin resultados» (§8). */
export async function hayAlgunaDevolucion(): Promise<boolean> {
  const [fila] = await db.execute<{ hay: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM returns) AS hay`);
  return fila.hay;
}
