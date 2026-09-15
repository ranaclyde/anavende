import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { domainError } from "@/lib/errors";

/**
 * Pedir y retirar la baja de la cuenta — FS RF-34, RN-13 · TS §13.5b. Tarea
 * F5.8.
 *
 * **El comprador pide, la administradora ejecuta** (F7.9). Pedirla deja la
 * cuenta en solo lectura (decisión del 2026-09-14): lo hace cumplir el
 * envoltorio de acciones, que mira `closure_requested_at`. Mientras no se
 * ejecutó, el comprador puede retirarla.
 *
 * **Sin email a la administradora** (decisión del 2026-09-14): el E5 de RF-30
 * quedó descartado. La baja pedida aparece como pendiente en el panel.
 *
 * Como en el resto del módulo, todo recibe el `userId` de la sesión (§13.8).
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type OrdenActiva = { numero: number };

async function ordenesActivasDe(
  ejecutor: Tx | typeof db,
  userId: string,
): Promise<OrdenActiva[]> {
  return [
    ...(await ejecutor.execute<OrdenActiva>(sql`
      SELECT order_number AS numero
        FROM orders
       WHERE user_id = ${userId} AND status = 'activa'
       ORDER BY created_at, id`)),
  ];
}

/**
 * Las órdenes que impiden la baja (RF-34). La pantalla las pide ANTES de
 * ofrecer el botón: con órdenes activas no se ofrece uno que va a fallar.
 */
export function ordenesActivas(userId: string): Promise<OrdenActiva[]> {
  return ordenesActivasDe(db, userId);
}

/** «la #12», «la #12 y la #15», «la #12, la #15 y la #20». */
function listar(ordenes: OrdenActiva[]): string {
  const nombres = ordenes.map((o) => `la #${o.numero}`);
  return nombres.length > 1
    ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`
    : nombres[0];
}

/**
 * «Tenés 1 orden activa (la #12)…»: cuántas y cuáles, y qué hacer (RF-34).
 *
 * **Desde F6.5 «Mis compras» existe**, así que el camino que nombra se puede
 * recorrer: se entra por el menú de la cuenta, se abre el pedido y se cancela
 * desde el detalle. Va nombrada y no enlazada porque este texto es el cuerpo
 * de un aviso y no una pantalla: meterle un enlace adentro obligaría a
 * devolver JSX desde un módulo que hoy devuelve una frase.
 */
export function mensajeDeOrdenesActivas(ordenes: OrdenActiva[]): string {
  const cuantas =
    ordenes.length === 1
      ? "Tenés 1 orden activa"
      : `Tenés ${ordenes.length} órdenes activas`;
  return `${cuantas} (${listar(ordenes)}). Podés cancelarla${ordenes.length === 1 ? "" : "s"} desde «Mis compras» o esperar a que se finalice${ordenes.length === 1 ? "" : "n"}, y después pedir la baja.`;
}

/**
 * Pedir la baja.
 *
 * **Bloquea al comprador** mientras cuenta sus órdenes activas: sin el
 * bloqueo, una orden confirmada en paralelo (F6.1) entraría después de
 * contar y la baja quedaría pedida con una orden abierta. `NO KEY` para no
 * frenar a quien inserte un carrito o un favorito, que referencian la fila.
 *
 * **Pedirla dos veces no pisa el motivo**: devuelve el pedido que ya estaba.
 * Pasa con un doble clic o con dos pestañas, y el motivo que vale es el
 * primero.
 *
 * Una administradora no se da de baja desde la tienda: su cuenta sostiene el
 * panel, y RF-26 ya le impide bloquearse a sí misma por lo mismo.
 */
export async function pedirBaja(
  userId: string,
  motivo: string,
): Promise<{ pedidaEl: string }> {
  // `pedidaEl` es texto y no `Date`: con SQL crudo, el driver devuelve las
  // fechas como las escribe Postgres. Nadie la usa para calcular; quien
  // muestra la fecha la lee del perfil, que drizzle sí convierte.
  return db.transaction(async (tx) => {
    const [perfil] = await tx.execute<{ role: string; pedidaEl: string | null }>(sql`
      SELECT role, closure_requested_at AS "pedidaEl"
        FROM user_profiles
       WHERE id = ${userId}
         FOR NO KEY UPDATE`);

    if (!perfil) throw domainError("NOT_FOUND");
    if (perfil.role !== "customer") {
      throw domainError("FORBIDDEN", {
        message: "Una cuenta de administradora no se da de baja desde acá.",
      });
    }
    if (perfil.pedidaEl) return { pedidaEl: perfil.pedidaEl };

    const activas = await ordenesActivasDe(tx, userId);
    if (activas.length > 0) {
      throw domainError("ACCOUNT_HAS_ACTIVE_ORDERS", {
        message: mensajeDeOrdenesActivas(activas),
        ordenes: activas.map((o) => o.numero),
      });
    }

    const [fila] = await tx.execute<{ pedidaEl: string }>(sql`
      UPDATE user_profiles
         SET closure_requested_at = now(),
             closure_reason       = ${motivo},
             updated_at           = now()
       WHERE id = ${userId}
      RETURNING closure_requested_at AS "pedidaEl"`);

    return { pedidaEl: fila.pedidaEl };
  });
}

/**
 * Retirar el pedido. **Retirar lo que no está pedido no es un error**, por lo
 * mismo que pedir dos veces.
 *
 * Cuando exista la baja ejecutada (F7.9), esto tiene que dejar de poder
 * deshacerla: ahí volver se le pide a la administradora (RF-34).
 */
export async function retirarBaja(
  userId: string,
): Promise<{ retirada: boolean }> {
  const filas = [
    ...(await db.execute<{ id: string }>(sql`
      UPDATE user_profiles
         SET closure_requested_at = NULL,
             closure_reason       = NULL,
             updated_at           = now()
       WHERE id = ${userId} AND closure_requested_at IS NOT NULL
      RETURNING id`)),
  ];
  return { retirada: filas.length > 0 };
}

/** Para el panel: cuántas bajas esperan que alguien las atienda (F7.8, F7.9). */
export async function contarBajasPendientes(): Promise<number> {
  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n
      FROM user_profiles
     WHERE closure_requested_at IS NOT NULL`);
  return fila.n;
}
