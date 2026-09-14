import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { domainError } from "@/lib/errors";

/**
 * Operaciones de favoritos — FS RF-10 · TS §5.5, §13.8. Tarea F5.4.
 *
 * **El favorito es del producto, no del color** (decisión del 2026-09-14).
 * Desde «Favoritos» no se agrega al carrito: la tarjeta lleva a la ficha, y
 * ahí se elige el color y la cantidad.
 *
 * Como en el carrito, **todas reciben el `userId` de la sesión** y nunca del
 * cliente: sin RLS, ese filtro es la única barrera (§13.8).
 */

/**
 * Guardar un producto. **Guardar lo que ya está guardado no es un error**:
 * pasa con dos pestañas abiertas, y la respuesta correcta es que quede
 * guardado, que es como ya está.
 *
 * Solo se guarda un producto ACTIVO: uno desactivado no existe para el sitio
 * público (RN-05). Uno que ya estaba guardado y se desactiva después se queda,
 * y la lista lo muestra como «No disponible» (RF-10).
 *
 * Una sola sentencia: el `INSERT` va en una CTE que Postgres ejecuta aunque
 * nadie la lea, y el `SELECT` de afuera dice si el producto existía.
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

/**
 * Quitar un producto. Se puede siempre, también si se desactivó: es la
 * única forma de sacarlo de la lista. Quitar lo que no está tampoco es un
 * error, por lo mismo que guardar dos veces.
 */
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
