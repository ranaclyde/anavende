import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { UserStatusEvent } from "@/db/schema";
import type { Money } from "@/lib/money";
import type { EstadoOrden } from "@/modules/orders/estados";
import {
  POR_PAGINA,
  type FiltrosDeUsuarios,
} from "@/modules/users/panel/filtros";

/**
 * Lecturas de usuarios para el panel — FS RF-26 · TS §5.6. Tarea F7.6.
 *
 * **Del panel y de nadie más**, como las de órdenes: no filtran por dueño
 * porque la administradora ve a todos, y la guardia es el layout de `/admin`
 * más el `.auth("admin")` de cada acción (§13.8). Por eso viven acá y no en
 * `modules/users/perfil.ts`, que es lo que cada persona ve de sí misma.
 */

export type RolDeUsuario = "admin" | "customer";

export type UsuarioDelListado = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: RolDeUsuario;
  bloqueado: boolean;
  /** RF-34: la pidió y nadie la ejecutó todavía. Es trabajo por hacer. */
  bajaPedida: boolean;
  /** RF-34: la baja ya ejecutada (F7.9). No es lo mismo que bloqueado. */
  dadoDeBaja: boolean;
  creadoEn: string;
  /** Cuántas órdenes tiene, que es lo que dice si es un cliente de verdad. */
  ordenes: number;
};

/** Los comodines de `ILIKE` se escapan: sin esto, buscar «50%» trae todo. */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

/**
 * Búsqueda por nombre o email — RF-26.
 *
 * Con `unaccent`, como el buscador de productos y el de órdenes: «Gomez»
 * tiene que encontrar a «Gómez». Sobre `full_name`, que es la columna
 * generada, así el nombre y el apellido se buscan juntos o por separado.
 */
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
  // «Activos» es lo que queda cuando se sacan las dos formas de estar afuera:
  // el bloqueo y la baja ejecutada. La baja **pedida** no saca a nadie de ahí
  // —la cuenta entra, en solo lectura— y por eso es un filtro aparte (RF-34).
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

/**
 * El listado, y cuántos hay en total.
 *
 * **Ordenado por rol y después por nombre**: las administradoras son unas
 * pocas y son a quienes se viene a mirar cuando se abre esta pantalla —quién
 * tiene acceso al panel—; los compradores se buscan por nombre o email.
 * Ordenar por fecha de alta, como las órdenes, dejaría a las administradoras
 * repartidas entre cientos de cuentas.
 */
export async function listarUsuarios(
  filtros: FiltrosDeUsuarios,
): Promise<{ usuarios: UsuarioDelListado[]; total: number }> {
  const where = condiciones(filtros);

  const [filas, [conteo]] = await Promise.all([
    db.execute<UsuarioDelListado>(sql`
      SELECT p.id,
             p.full_name  AS nombre,
             p.email,
             p.phone      AS telefono,
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

  return { usuarios: [...filas], total: conteo.total };
}

export type OrdenDelUsuario = {
  numero: number;
  estado: EstadoOrden;
  creadaEn: string;
  total: Money;
  unidades: number;
};

/** Una fila del historial de la cuenta — RF-27, RF-34, §5.3. F7.7 y F7.9. */
export type MovimientoDeEstado = {
  evento: UserStatusEvent;
  motivo: string | null;
  autor: string | null;
  fecha: string;
};

export type UsuarioDelPanel = UsuarioDelListado & {
  firstName: string;
  lastName: string;
  /** RF-27: el motivo del bloqueo y quién lo hizo. Lo escribe F7.7. */
  motivoDelBloqueo: string | null;
  bloqueadoEn: string | null;
  bloqueadoPor: string | null;
  /**
   * RF-34: el motivo de la baja, que escribió el comprador (F5.8).
   *
   * **Sigue estando después de ejecutarla**, y es a propósito: es lo que
   * contesta por qué esa cuenta ya no está. Lo que lo borra es revertirla, y
   * ahí queda en el historial.
   */
  motivoDeLaBaja: string | null;
  bajaPedidaEn: string | null;
  /** RF-34, F7.9: cuándo la ejecutó la administradora, y cuál. */
  dadoDeBajaEn: string | null;
  dadoDeBajaPor: string | null;
  /** Las últimas cinco, que es lo que la ficha muestra. */
  ultimasOrdenes: OrdenDelUsuario[];
  /**
   * Todo lo que le pasó a la cuenta, del más nuevo al más viejo: bloqueos y
   * desbloqueos (RF-27), bajas ejecutadas y revertidas (RF-34).
   *
   * **Es lo único que queda cuando la cuenta vuelve a estar desbloqueada**:
   * las columnas de arriba dicen cómo está hoy, no lo que pasó. Va entera y
   * no paginada porque es una lista que casi siempre está vacía y nunca va a
   * tener veinte filas: una cuenta se bloquea una vez, o ninguna.
   */
  historialDeEstado: MovimientoDeEstado[];
};

/**
 * Una ficha entera — RF-26.
 *
 * **Las órdenes vienen acá y no en otra consulta**: son cinco filas de la
 * misma ida a la base, y la ficha no se dibuja sin ellas. El total sí se
 * cuenta aparte en la misma vuelta, porque «las últimas cinco» no dice si hay
 * seis o seiscientas, y ese número es el que decide si vale la pena abrir el
 * listado completo.
 */
export async function leerUsuarioDelPanel(
  id: string,
): Promise<UsuarioDelPanel | null> {
  const [fila] = await db.execute<UsuarioDelPanel>(sql`
    SELECT p.id,
           p.full_name  AS nombre,
           p.first_name AS "firstName",
           p.last_name  AS "lastName",
           p.email,
           p.phone      AS telefono,
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

  return fila ?? null;
}

/**
 * Cuántas administradoras hay.
 *
 * Lo usa la regla que impide dejar la tienda sin ninguna: RF-26 pide que la
 * administradora no pueda quitarse el rol a sí misma, y quitárselo **a la
 * última** deja exactamente el mismo desastre por otro camino —nadie puede
 * entrar al panel, y volver a tener acceso es un `UPDATE` a mano en la base—.
 */
export async function contarAdministradoras(): Promise<number> {
  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM user_profiles WHERE role = 'admin'`);
  return fila.n;
}
