import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { domainError } from "@/lib/errors";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";

/**
 * Todas reciben el `userId` de la sesión y ninguna el id del carrito: sin RLS,
 * es la única barrera entre carritos (§13.8).
 *
 * El carrito no reserva stock (RF-08); controlar lo disponible al agregar es
 * cortesía, la garantía es la reconfirmación de §8.4.
 *
 * Agregar y cambiar la cantidad bloquean la fila del carrito: leen antes de
 * escribir, y dos pestañas a la vez perderían una unidad.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LineaDelCarrito = { variantId: string; cantidad: number };

/**
 * `DO UPDATE` y no `DO NOTHING`: el `UPDATE` toma el bloqueo de fila si el
 * carrito ya existe, y hace que el `RETURNING` devuelva algo.
 */
async function crearOBloquear(tx: Tx, userId: string): Promise<string> {
  const [carrito] = await tx.execute<{ id: string }>(sql`
    INSERT INTO carts (user_id) VALUES (${userId})
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING id`);
  return carrito.id;
}

async function bloquear(tx: Tx, userId: string): Promise<string | null> {
  const [carrito] = await tx.execute<{ id: string }>(sql`
    SELECT id FROM carts WHERE user_id = ${userId} FOR UPDATE`);
  return carrito?.id ?? null;
}

async function cantidadActual(
  tx: Tx,
  cartId: string,
  variantId: string,
): Promise<number> {
  const [fila] = await tx.execute<{ quantity: number }>(sql`
    SELECT quantity FROM cart_items
     WHERE cart_id = ${cartId} AND variant_id = ${variantId}`);
  return fila?.quantity ?? 0;
}

/** El `greatest(…, 0)`: un disponible negativo (RF-24) es, para quien compra, cero. */
async function disponibleDe(tx: Tx, variantId: string): Promise<number> {
  const [v] = await tx.execute<{ seVende: boolean; disponible: number }>(sql`
    SELECT v.is_active AND p.is_active AS "seVende",
           greatest(v.stock_total - v.reserved_stock, 0)::int AS disponible
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
     WHERE v.id = ${variantId}`);

  if (!v) throw domainError("NOT_FOUND");

  // El mensaje por omisión dice «lo sacamos de tu carrito»; acá todavía no entró.
  if (!v.seVende) {
    throw domainError("PRODUCT_UNAVAILABLE", {
      message: "Ese producto ya no está disponible.",
    });
  }

  return v.disponible;
}

function noAlcanza(disponible: number, enElCarrito: number) {
  const tope = Math.min(disponible, TOPE_POR_ITEM);

  const cuantas =
    tope < disponible
      ? `Podés llevar hasta ${tope} unidades de un mismo producto`
      : tope === 1
        ? "Queda 1 sola unidad"
        : `Quedan ${tope} unidades`;

  const message =
    tope === 0
      ? // Sin «este color»: hay productos que no se venden por color.
        "Se quedó sin stock."
      : enElCarrito > 0
        ? `${cuantas} y ya tenés ${enElCarrito} en el carrito.`
        : `${cuantas}.`;

  return domainError("INSUFFICIENT_STOCK", {
    message,
    quedan: tope,
    enElCarrito,
  });
}

/** Si la variante ya estaba, suma en el mismo renglón (UNIQUE de §5.5). */
export async function agregar(
  userId: string,
  { variantId, cantidad }: LineaDelCarrito,
): Promise<{ cantidad: number }> {
  return db.transaction(async (tx) => {
    const cartId = await crearOBloquear(tx, userId);
    const disponible = await disponibleDe(tx, variantId);
    const enElCarrito = await cantidadActual(tx, cartId, variantId);

    const nueva = enElCarrito + cantidad;
    if (nueva > Math.min(disponible, TOPE_POR_ITEM)) {
      throw noAlcanza(disponible, enElCarrito);
    }

    // El precio a la vista pasa a ser el «visto», también si el renglón ya existía.
    await tx.execute(sql`
      INSERT INTO cart_items (cart_id, variant_id, quantity, last_seen_price)
      SELECT ${cartId}, v.id, ${nueva}, p.final_price
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
       WHERE v.id = ${variantId}
      ON CONFLICT (cart_id, variant_id) DO UPDATE
        SET quantity        = excluded.quantity,
            last_seen_price = excluded.last_seen_price`);

    return { cantidad: nueva };
  });
}

/**
 * Bajar se puede siempre, aunque el stock ya no alcance: si no, quien tiene 4
 * y quedan 1 no podría acercarse. Solo se controla lo disponible al subir.
 */
export async function cambiarCantidad(
  userId: string,
  { variantId, cantidad }: LineaDelCarrito,
): Promise<{ cantidad: number }> {
  return db.transaction(async (tx) => {
    const cartId = await bloquear(tx, userId);
    const actual = cartId ? await cantidadActual(tx, cartId, variantId) : 0;

    if (!cartId || actual === 0) {
      throw domainError("NOT_FOUND", {
        message: "Ese producto ya no está en tu carrito.",
      });
    }

    if (cantidad > actual) {
      const disponible = await disponibleDe(tx, variantId);
      if (cantidad > Math.min(disponible, TOPE_POR_ITEM)) {
        throw noAlcanza(disponible, 0);
      }
    }

    await tx.execute(sql`
      UPDATE cart_items SET quantity = ${cantidad}
       WHERE cart_id = ${cartId} AND variant_id = ${variantId}`);

    return { cantidad };
  });
}

/** Quitar algo que ya no está no es un error (doble clic, dos pestañas). */
export async function quitar(
  userId: string,
  variantId: string,
): Promise<{ quitado: boolean }> {
  const filas = [
    ...(await db.execute<{ id: string }>(sql`
      DELETE FROM cart_items ci
       USING carts c
       WHERE ci.cart_id = c.id
         AND c.user_id = ${userId}
         AND ci.variant_id = ${variantId}
      RETURNING ci.id`)),
  ];
  return { quitado: filas.length > 0 };
}

/** Se van los renglones y el carrito queda: es uno por usuario (§5.5). */
export async function vaciar(userId: string): Promise<{ quitados: number }> {
  const filas = [
    ...(await db.execute<{ id: string }>(sql`
      DELETE FROM cart_items ci
       USING carts c
       WHERE ci.cart_id = c.id
         AND c.user_id = ${userId}
      RETURNING ci.id`)),
  ];
  return { quitados: filas.length };
}
