import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { TIME_ZONE } from "@/lib/dates";
import type { Money } from "@/lib/money";
import type { EstadoOrden } from "@/modules/orders/estados";
import {
  estadoDeLaSolapa,
  POR_PAGINA,
  type FiltrosDeOrdenes,
  type Solapa,
} from "@/modules/orders/filtros-panel";
import type { ItemDeLaOrden } from "@/modules/orders/queries";

/**
 * Lecturas del panel: no filtran por `user_id`, al revés de `queries.ts`. La
 * guardia es el rol admin; no mezclarlas en un archivo (§13.8).
 */

export type OrigenDeOrden = "web" | "manual";

export type OrdenDelListado = {
  numero: number;
  estado: EstadoOrden;
  origen: OrigenDeOrden;
  /** ISO, como la devuelve el driver con SQL crudo. */
  creadaEn: string;
  customerName: string;
  customerEmail: string | null;
  total: Money;
  /** Unidades, no renglones. */
  unidades: number;
  /** Con dirección es un envío; sin ella, un retiro (`entrega.ts`). */
  shippingAddress: object | null;
};

/** Sin esto, buscar «50%» con `ILIKE` traería todo. */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

/** El número se compara exacto («104» no trae la #1043); nombre y email, por subcadena. */
function condicionDeBusqueda(q: string): SQL {
  const termino = sql`immutable_unaccent(lower(${escaparComodines(q)}))`;
  const soloDigitos = q.replace(/^#/, "");
  const porNumero = /^\d{1,9}$/.test(soloDigitos)
    ? sql`o.order_number = ${Number.parseInt(soloDigitos, 10)} OR `
    : sql``;

  return sql`(
    ${porNumero}
       immutable_unaccent(lower(o.customer_name))              ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(coalesce(o.customer_email, ''))) ILIKE '%' || ${termino} || '%'
  )`;
}

/**
 * Finalizadas y canceladas filtran por la fecha de su estado: el tablero
 * cuenta ventas por `finalized_at` y enlaza acá, y los dos números tienen que coincidir.
 */
function columnaDelRango(solapa: Solapa): SQL {
  if (solapa === "finalizadas") return sql`o.finalized_at`;
  if (solapa === "canceladas") return sql`o.cancelled_at`;
  return sql`o.created_at`;
}

/**
 * Compartido por el listado y el conteo. `hasta` se compara con el día
 * siguiente para incluirlo entero, y los cortes van en la zona del negocio:
 * el servidor corre en UTC y el filtro no coincidiría con la fecha que se muestra.
 */
function condiciones(filtros: FiltrosDeOrdenes): SQL {
  const partes: SQL[] = [];
  const cuando = columnaDelRango(filtros.solapa);

  const estado = estadoDeLaSolapa(filtros.solapa);
  if (estado) partes.push(sql`o.status = ${estado}`);
  if (filtros.origen !== "todos") {
    partes.push(sql`o.origin = ${filtros.origen}`);
  }
  if (filtros.q) partes.push(condicionDeBusqueda(filtros.q));
  if (filtros.desde) {
    partes.push(sql`${cuando} >=
      (${filtros.desde}::date)::timestamp AT TIME ZONE ${TIME_ZONE}`);
  }
  if (filtros.hasta) {
    partes.push(sql`${cuando} <
      (${filtros.hasta}::date + 1)::timestamp AT TIME ZONE ${TIME_ZONE}`);
  }

  return partes.length
    ? sql`WHERE ${sql.join(partes, sql` AND `)}`
    : sql`WHERE true`;
}

/** Una página del listado, de la más nueva a la más vieja, y el total. */
export async function listarOrdenesDelPanel(
  filtros: FiltrosDeOrdenes,
): Promise<{ ordenes: OrdenDelListado[]; total: number }> {
  const where = condiciones(filtros);

  const [filas, [conteo]] = await Promise.all([
    db.execute<OrdenDelListado>(sql`
      SELECT o.order_number     AS numero,
             o.status           AS estado,
             o.origin           AS origen,
             o.created_at       AS "creadaEn",
             o.customer_name    AS "customerName",
             o.customer_email   AS "customerEmail",
             o.total,
             o.shipping_address AS "shippingAddress",
             (SELECT coalesce(sum(i.quantity), 0)::int
                FROM order_items i WHERE i.order_id = o.id) AS unidades
        FROM orders o
        ${where}
       ORDER BY o.created_at DESC, o.order_number DESC
       LIMIT ${POR_PAGINA} OFFSET ${(filtros.pagina - 1) * POR_PAGINA}`),
    db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM orders o ${where}`),
  ]);

  return { ordenes: [...filas], total: conteo.total };
}

export async function contarPorEstado(): Promise<Record<EstadoOrden, number>> {
  const filas = await db.execute<{ estado: EstadoOrden; n: number }>(sql`
    SELECT status AS estado, count(*)::int AS n FROM orders GROUP BY status`);

  const conteo: Record<EstadoOrden, number> = {
    activa: 0,
    finalizada: 0,
    cancelada: 0,
  };
  for (const fila of filas) conteo[fila.estado] = fila.n;
  return conteo;
}

/**
 * `esElComprador` compara con el dueño de la orden, no con el rol: el rol es
 * el de hoy y puede haber cambiado desde la transición.
 */
export type EntradaDelHistorial = {
  desde: EstadoOrden | null;
  hacia: EstadoOrden;
  motivo: string | null;
  /** El nombre del perfil, o `null` si la hizo el sistema o el perfil ya no está. */
  autor: string | null;
  esElComprador: boolean;
  cuando: string;
};

/**
 * El snapshot del renglón más los contadores de hoy. Cancelar y editar miran
 * `disponible`; finalizar mira `stock`, porque baja total y reserva a la vez y
 * el disponible no cambia. `null` si la variante ya no existe.
 */
export type ItemDeLaOrdenDelPanel = ItemDeLaOrden & {
  disponible: number | null;
  stock: number | null;
};

export type OrdenDelPanel = {
  numero: number;
  estado: EstadoOrden;
  origen: OrigenDeOrden;
  creadaEn: string;
  finalizadaEn: string | null;
  canceladaEn: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  shippingAddress: ShippingAddressSnapshot | null;
  notas: string | null;
  total: Money;
  unidades: number;
  items: ItemDeLaOrdenDelPanel[];
  /** La cuenta, que puede no coincidir con el snapshot de arriba (compra para un tercero). */
  cuenta: { id: string; nombre: string; email: string } | null;
  historial: EntradaDelHistorial[];
};

/**
 * Los montos van a `::text` porque `json_build_object` convierte `numeric` a
 * número de JavaScript y se pierden centavos.
 */
export async function leerOrdenDelPanel(
  numero: number,
): Promise<OrdenDelPanel | null> {
  const [fila] = await db.execute<Omit<OrdenDelPanel, "unidades">>(sql`
    SELECT o.order_number     AS numero,
           o.status           AS estado,
           o.origin           AS origen,
           o.created_at       AS "creadaEn",
           o.finalized_at     AS "finalizadaEn",
           o.cancelled_at     AS "canceladaEn",
           o.customer_name    AS "customerName",
           o.customer_email   AS "customerEmail",
           o.customer_phone   AS "customerPhone",
           o.shipping_address AS "shippingAddress",
           o.notes            AS notas,
           o.total,
           CASE WHEN p.id IS NULL THEN NULL ELSE
             json_build_object('id', p.id, 'nombre', p.full_name,
                               'email', p.email)
           END AS cuenta,
           (SELECT coalesce(
                     json_agg(
                       json_build_object(
                         'id',             i.id,
                         'nombre',         i.product_name,
                         'marca',          i.brand_name,
                         'color',          i.color_name,
                         'cantidad',       i.quantity,
                         'precioUnitario', i.unit_price::text,
                         'subtotal',       i.subtotal::text,
                         'disponible',     CASE WHEN v.id IS NULL THEN NULL
                                                ELSE v.stock_total
                                                     - v.reserved_stock END,
                         'stock',          v.stock_total
                       )
                       ORDER BY i.product_name, i.color_name
                     ),
                     '[]'::json)
              FROM order_items i
              LEFT JOIN product_variants v ON v.id = i.variant_id
             WHERE i.order_id = o.id) AS items,
           (SELECT coalesce(
                     json_agg(
                       json_build_object(
                         'desde',         h.from_status,
                         'hacia',         h.to_status,
                         'motivo',        h.reason,
                         'autor',         a.full_name,
                         'esElComprador', h.actor_user_id IS NOT NULL
                                          AND h.actor_user_id = o.user_id,
                         'cuando',        h.created_at
                       )
                       ORDER BY h.created_at, h.id
                     ),
                     '[]'::json)
              FROM order_status_history h
              LEFT JOIN user_profiles a ON a.id = h.actor_user_id
             WHERE h.order_id = o.id) AS historial
      FROM orders o
      LEFT JOIN user_profiles p ON p.id = o.user_id
     WHERE o.order_number = ${numero}`);

  if (!fila) return null;

  const unidades = fila.items.reduce((suma, item) => suma + item.cantidad, 0);
  return { ...fila, unidades };
}

/** Sin filtrar por dueño, al revés de `idDeMiOrden`: solo para acciones `.auth("admin")`. */
export async function idDeLaOrden(numero: number): Promise<string | null> {
  const [fila] = await db.execute<{ id: string }>(sql`
    SELECT id FROM orders WHERE order_number = ${numero}`);
  return fila?.id ?? null;
}
