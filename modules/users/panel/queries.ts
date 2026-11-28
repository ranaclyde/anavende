import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { UserStatusEvent } from "@/db/schema";
import type { Money } from "@/lib/money";
import type { EstadoOrden } from "@/modules/orders/estados";
import { caraDe } from "@/modules/users/avatar";
import {
  POR_PAGINA,
  type FiltroDeEstado,
  type FiltrosDeUsuarios,
} from "@/modules/users/panel/filtros";

/**
 * Solo para el panel: no filtran por dueño, y la guardia es el layout de
 * `/admin` más el `.auth("admin")` de cada acción (§13.8).
 */

export type RolDeUsuario = "admin" | "customer";

export type UsuarioDelListado = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  cara: string;
  tieneFoto: boolean;
  rol: RolDeUsuario;
  bloqueado: boolean;
  bajaPedida: boolean;
  dadoDeBaja: boolean;
  creadoEn: string;
  ordenes: number;
};

type ConFoto<T> = Omit<T, "cara" | "tieneFoto"> & { avatarKey: string | null };

function conCara<T extends { id: string }>({
  avatarKey,
  ...fila
}: T & { avatarKey: string | null }) {
  return {
    ...fila,
    cara: caraDe({ id: fila.id, avatarKey }),
    tieneFoto: avatarKey !== null,
  };
}

/** Los comodines de `ILIKE` se escapan: sin esto, buscar «50%» trae todo. */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

function condicionDeBusqueda(q: string): SQL {
  const termino = sql`immutable_unaccent(lower(${escaparComodines(q)}))`;
  return sql`(
       immutable_unaccent(lower(p.full_name)) ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(p.email))     ILIKE '%' || ${termino} || '%'
  )`;
}

function condiciones(filtros: FiltrosDeUsuarios): SQL {
  const partes: SQL[] = [];

  if (filtros.q) partes.push(condicionDeBusqueda(filtros.q));
  if (filtros.rol !== "todos") partes.push(sql`p.role = ${filtros.rol}`);
  // La baja pedida no saca de «activos»: la cuenta entra, en solo lectura.
  if (filtros.estado === "bloqueados") partes.push(sql`p.is_banned`);
  if (filtros.estado === "dados-de-baja")
    partes.push(sql`p.closed_at IS NOT NULL`);
  if (filtros.estado === "baja-pedida")
    partes.push(
      sql`p.closure_requested_at IS NOT NULL AND p.closed_at IS NULL`,
    );
  if (filtros.estado === "activos")
    partes.push(sql`NOT p.is_banned AND p.closed_at IS NULL`);

  return partes.length
    ? sql`WHERE ${sql.join(partes, sql` AND `)}`
    : sql`WHERE true`;
}

export async function listarUsuarios(
  filtros: FiltrosDeUsuarios,
): Promise<{ usuarios: UsuarioDelListado[]; total: number }> {
  const where = condiciones(filtros);

  const [filas, [conteo]] = await Promise.all([
    db.execute<ConFoto<UsuarioDelListado>>(sql`
      SELECT p.id,
             p.full_name  AS nombre,
             p.email,
             p.phone      AS telefono,
             p.avatar_key AS "avatarKey",
             p.role       AS rol,
             p.is_banned  AS bloqueado,
             (p.closure_requested_at IS NOT NULL
              AND p.closed_at IS NULL)        AS "bajaPedida",
             p.closed_at IS NOT NULL          AS "dadoDeBaja",
             p.created_at AS "creadoEn",
             (SELECT count(*)::int FROM orders o WHERE o.user_id = p.id)
               AS ordenes
        FROM user_profiles p
        ${where}
       ORDER BY p.role, p.full_name
       LIMIT ${POR_PAGINA} OFFSET ${(filtros.pagina - 1) * POR_PAGINA}`),
    db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM user_profiles p ${where}`),
  ]);

  return { usuarios: filas.map(conCara), total: conteo.total };
}

/**
 * No recibe los filtros a propósito: la solapa cuenta el total (§6.9). Los
 * cinco números se pisan y no suman el total. Las condiciones tienen que ser
 * las mismas de `condiciones()`, o la solapa y el listado no coincidirían.
 */
export async function contarPorEstado(): Promise<
  Record<FiltroDeEstado, number>
> {
  const [fila] = await db.execute<Record<FiltroDeEstado, number>>(sql`
    SELECT count(*)::int AS "todos",
           count(*) FILTER (
             WHERE NOT is_banned AND closed_at IS NULL)::int AS "activos",
           count(*) FILTER (WHERE is_banned)::int AS "bloqueados",
           count(*) FILTER (
             WHERE closure_requested_at IS NOT NULL
               AND closed_at IS NULL)::int          AS "baja-pedida",
           count(*) FILTER (
             WHERE closed_at IS NOT NULL)::int      AS "dados-de-baja"
      FROM user_profiles`);

  return fila;
}

export type OrdenDelUsuario = {
  numero: number;
  estado: EstadoOrden;
  creadaEn: string;
  total: Money;
  unidades: number;
};

export type MovimientoDeEstado = {
  evento: UserStatusEvent;
  motivo: string | null;
  autor: string | null;
  fecha: string;
};

export type UsuarioDelPanel = UsuarioDelListado & {
  firstName: string;
  lastName: string;
  motivoDelBloqueo: string | null;
  bloqueadoEn: string | null;
  bloqueadoPor: string | null;
  /** Sigue después de ejecutar la baja, a propósito; revertirla lo borra. */
  motivoDeLaBaja: string | null;
  bajaPedidaEn: string | null;
  dadoDeBajaEn: string | null;
  dadoDeBajaPor: string | null;
  ultimasOrdenes: OrdenDelUsuario[];
  historialDeEstado: MovimientoDeEstado[];
};

export async function leerUsuarioDelPanel(
  id: string,
): Promise<UsuarioDelPanel | null> {
  const [fila] = await db.execute<ConFoto<UsuarioDelPanel>>(sql`
    SELECT p.id,
           p.full_name  AS nombre,
           p.first_name AS "firstName",
           p.last_name  AS "lastName",
           p.email,
           p.phone      AS telefono,
           p.avatar_key AS "avatarKey",
           p.role       AS rol,
           p.is_banned  AS bloqueado,
           p.ban_reason AS "motivoDelBloqueo",
           p.banned_at  AS "bloqueadoEn",
           b.full_name  AS "bloqueadoPor",
           (p.closure_requested_at IS NOT NULL
            AND p.closed_at IS NULL)        AS "bajaPedida",
           p.closed_at IS NOT NULL          AS "dadoDeBaja",
           p.closure_reason       AS "motivoDeLaBaja",
           p.closure_requested_at AS "bajaPedidaEn",
           p.closed_at            AS "dadoDeBajaEn",
           c.full_name            AS "dadoDeBajaPor",
           p.created_at AS "creadoEn",
           (SELECT count(*)::int FROM orders o WHERE o.user_id = p.id)
             AS ordenes,
           (SELECT coalesce(
                     json_agg(
                       json_build_object(
                         'numero',   u.order_number,
                         'estado',   u.status,
                         'creadaEn', u.created_at,
                         'total',    u.total::text,
                         'unidades', (SELECT coalesce(sum(i.quantity), 0)::int
                                        FROM order_items i
                                       WHERE i.order_id = u.id)
                       )
                       ORDER BY u.created_at DESC, u.order_number DESC
                     ),
                     '[]'::json)
              FROM (SELECT o.* FROM orders o
                     WHERE o.user_id = p.id
                     ORDER BY o.created_at DESC, o.order_number DESC
                     LIMIT 5) u) AS "ultimasOrdenes",
           (SELECT coalesce(
                     json_agg(
                       json_build_object(
                         'evento', h.event,
                         'motivo', h.reason,
                         'autor',  a.full_name,
                         'fecha',  h.created_at
                       )
                       ORDER BY h.created_at DESC
                     ),
                     '[]'::json)
              FROM user_status_history h
              LEFT JOIN user_profiles a ON a.id = h.actor_user_id
             WHERE h.user_id = p.id) AS "historialDeEstado"
      FROM user_profiles p
      LEFT JOIN user_profiles b ON b.id = p.banned_by
      LEFT JOIN user_profiles c ON c.id = p.closed_by
     WHERE p.id = ${id}`);

  return fila ? conCara(fila) : null;
}

export async function contarAdministradoras(): Promise<number> {
  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM user_profiles WHERE role = 'admin'`);
  return fila.n;
}
