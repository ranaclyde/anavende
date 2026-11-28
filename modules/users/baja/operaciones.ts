import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { domainError } from "@/lib/errors";

// El comprador pide y la administradora ejecuta (§13.5b). Todo recibe el
// `userId` de la sesión (§13.8).

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

export function ordenesActivas(userId: string): Promise<OrdenActiva[]> {
  return ordenesActivasDe(db, userId);
}

function listar(ordenes: OrdenActiva[]): string {
  const nombres = ordenes.map((o) => `la #${o.numero}`);
  return nombres.length > 1
    ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`
    : nombres[0];
}

export function mensajeDeOrdenesActivas(ordenes: OrdenActiva[]): string {
  const cuantas =
    ordenes.length === 1
      ? "Tenés 1 orden activa"
      : `Tenés ${ordenes.length} órdenes activas`;
  return `${cuantas} (${listar(ordenes)}). Podés cancelarla${ordenes.length === 1 ? "" : "s"} desde «Mis compras» o esperar a que se finalice${ordenes.length === 1 ? "" : "n"}, y después pedir la baja.`;
}

/**
 * Bloquea al comprador mientras cuenta sus órdenes activas: si no, una orden
 * confirmada en paralelo entraría después de contar. `NO KEY` no frena a quien
 * inserte un carrito o un favorito. Pedirla dos veces no pisa el motivo.
 */
export async function pedirBaja(
  userId: string,
  motivo: string,
): Promise<{ pedidaEl: string }> {
  // `pedidaEl` es texto: con SQL crudo, el driver no convierte las fechas.
  return db.transaction(async (tx) => {
    const [perfil] = await tx.execute<{
      role: string;
      pedidaEl: string | null;
    }>(sql`
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
 * El `closed_at IS NULL` es toda la regla que impide que alguien dado de baja
 * se reabra la cuenta solo: el envoltorio deja pasar esta acción, y el token
 * emitido sigue sirviendo hasta la próxima ruta privada (§13.3).
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
       WHERE id = ${userId}
         AND closure_requested_at IS NOT NULL
         AND closed_at IS NULL
      RETURNING id`)),
  ];
  return { retirada: filas.length > 0 };
}

export async function contarBajasPendientes(): Promise<number> {
  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n
      FROM user_profiles
     WHERE closure_requested_at IS NOT NULL AND closed_at IS NULL`);
  return fila.n;
}
