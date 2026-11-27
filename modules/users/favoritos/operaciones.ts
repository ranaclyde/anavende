import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { domainError } from "@/lib/errors";

// El `userId` sale de la sesión y nunca del cliente: sin RLS, es la única
// barrera (§13.8).

/**
 * Solo productos activos (RN-05); guardar dos veces no es un error. El
 * `INSERT` va en una CTE que Postgres ejecuta aunque nadie la lea.
 */
export async function marcar(
  userId: string,
  productId: string,
): Promise<{ marcado: true }> {
  const [fila] = await db.execute<{ existe: boolean }>(sql`
    WITH producto AS (
      SELECT id FROM products WHERE id = ${productId} AND is_active
    ), alta AS (
      INSERT INTO favorites (user_id, product_id)
      SELECT ${userId}, id FROM producto
      ON CONFLICT (user_id, product_id) DO NOTHING
    )
    SELECT EXISTS (SELECT 1 FROM producto) AS existe`);

  if (!fila.existe) {
    throw domainError("PRODUCT_UNAVAILABLE", {
      message: "Ese producto ya no está disponible.",
    });
  }

  return { marcado: true };
}

/** Sin mirar si está activo: es la única forma de sacar uno desactivado. */
export async function desmarcar(
  userId: string,
  productId: string,
): Promise<{ quitado: boolean }> {
  const filas = [
    ...(await db.execute<{ productId: string }>(sql`
      DELETE FROM favorites
       WHERE user_id = ${userId} AND product_id = ${productId}
      RETURNING product_id AS "productId"`)),
  ];
  return { quitado: filas.length > 0 };
}
