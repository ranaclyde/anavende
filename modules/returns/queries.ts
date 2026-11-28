import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { ZONA_HORARIA } from "@/lib/fechas";
import type { Money } from "@/lib/money";
import {
  POR_PAGINA,
  type FiltrosDeDevoluciones,
} from "@/modules/returns/filtros";

// Los montos salen como `::text`: `json_build_object` convertiría el `numeric`
// a número de JavaScript y se perderían centavos.

export type EstadoDeDevolucion = "registrada" | "anulada";

export type ItemDevuelto = {
  orderItemId: string;
  nombre: string;
  color: string | null;
  cantidad: number;
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
  /** Al precio de esa orden (RN-12), no al de hoy. */
  monto: Money;
  items: ItemDevuelto[];
};

export type DevolucionDelListado = Devolucion & {
  numero: number;
  customerName: string;
};

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
 * Por número de orden y no por `id`, para que el detalle la pida en paralelo
 * con la orden y no en cascada.
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
 * Solo cuenta las registradas, el mismo criterio del tope de `registrar.ts`:
 * si contaran distinto, la pantalla ofrecería lo que el dominio rechaza.
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
 * Compartido por las filas y el conteo. El rango va `AT TIME ZONE` a la zona
 * del negocio e incluye el día de `hasta` entero: el servidor corre en UTC.
 */
function condiciones(filtros: FiltrosDeDevoluciones): SQL {
  const partes: SQL[] = [];

  if (filtros.estado !== "todas") {
    partes.push(
      sql`r.status = ${filtros.estado === "registradas" ? "registrada" : "anulada"}`,
    );
  }

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

/** Del total, no del filtro puesto: una solapa es un indicador. */
export async function contarDevolucionesPorEstado(): Promise<{
  registradas: number;
  anuladas: number;
}> {
  const [fila] = await db.execute<{ registradas: number; anuladas: number }>(
    sql`
    SELECT count(*) FILTER (WHERE status = 'registrada')::int AS registradas,
           count(*) FILTER (WHERE status = 'anulada')::int    AS anuladas
      FROM returns`,
  );
  return fila;
}
