import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { domainError } from "@/lib/errors";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";

/**
 * Operaciones del carrito — FS RF-08 · TS §5.5, §13.8. Tarea F5.5.
 *
 * **Todas reciben el `userId` y ninguna el id del carrito.** Sin RLS, el
 * filtro por la identidad de la sesión es la única barrera entre el carrito
 * de un comprador y el de otro (§13.8). Si una operación aceptara un
 * `cartId`, bastaría con cambiarlo para tocar un carrito ajeno; el `userId`
 * sale de la sesión y nunca del cliente, así que no hay nada que cambiar.
 *
 * **El carrito no reserva stock** (RF-08): eso pasa al confirmar (§8.4). Lo
 * que sí se controla es no dejar pedir más de lo que hay, para que el
 * comprador se entere al agregar y no al confirmar. Es cortesía, no garantía:
 * entre agregar y confirmar alguien más puede comprar, y para eso está la
 * reconfirmación de §8.4.
 *
 * **Agregar y cambiar la cantidad bloquean la fila del carrito.** Las dos
 * leen lo que hay antes de escribir, y sin el bloqueo dos pestañas agregando
 * a la vez leerían «hay 2», escribirían 3 cada una y se perdería una unidad.
 * El bloqueo es sobre el carrito de ESE comprador: no frena a nadie más.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LineaDelCarrito = { variantId: string; cantidad: number };

/**
 * El carrito del comprador, creado si no existía, y bloqueado.
 *
 * El `DO UPDATE` y no un `DO NOTHING`: el `UPDATE` es lo que toma el bloqueo
 * de fila cuando el carrito ya existe, y es también lo único que hace que el
 * `RETURNING` devuelva algo en ese caso.
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

/**
 * Lo que se puede vender de una variante, o el error de por qué no.
 *
 * El `greatest(…, 0)` es RF-24: el stock puede quedar NEGATIVO por una venta
 * cargada sobre unidades que el sistema no tenía. Es una discrepancia de la
 * vendedora, y para quien compra es lo mismo que cero.
 */
async function disponibleDe(tx: Tx, variantId: string): Promise<number> {
  const [v] = await tx.execute<{ seVende: boolean; disponible: number }>(sql`
    SELECT v.is_active AND p.is_active AS "seVende",
           greatest(v.stock_total - v.reserved_stock, 0)::int AS disponible
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
     WHERE v.id = ${variantId}`);

  if (!v) throw domainError("NOT_FOUND");

  // El mensaje por omisión dice «lo sacamos de tu carrito», que es el caso
  // de F5.6. Acá todavía no entró.
  if (!v.seVende) {
    throw domainError("PRODUCT_UNAVAILABLE", {
      message: "Ese producto ya no está disponible.",
    });
  }

  return v.disponible;
}

/**
 * «No alcanza», dicho con el número que sirve: cuántas quedan y cuántas ya
 * tiene. Un «no hay stock suficiente» a secas deja a la persona probando
 * cantidades hasta que una entre.
 */
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
      ? "Este color se quedó sin stock."
      : enElCarrito > 0
        ? `${cuantas} y ya tenés ${enElCarrito} en el carrito.`
        : `${cuantas}.`;

  return domainError("INSUFFICIENT_STOCK", {
    message,
    quedan: tope,
    enElCarrito,
  });
}

/**
 * Agregar una variante. Si ya estaba, suma en el mismo renglón: el UNIQUE
 * `(cart_id, variant_id)` de §5.5 dice que una variante es un renglón.
 *
 * Devuelve cuántas quedaron en el carrito, que es lo que la ficha le dice a
 * quien acaba de agregar.
 */
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

    await tx.execute(sql`
      INSERT INTO cart_items (cart_id, variant_id, quantity)
      VALUES (${cartId}, ${variantId}, ${nueva})
      ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = excluded.quantity`);

    return { cantidad: nueva };
  });
}

/**
 * Cambiar la cantidad de un renglón.
 *
 * **Bajar se puede siempre**, aunque el stock ya no alcance para lo que
 * queda: rechazar que alguien pase de 4 a 3 porque ahora hay 1 lo dejaría sin
 * forma de acercarse a lo que hay. Solo se controla lo disponible al subir.
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

/**
 * Quitar un renglón. **Quitar algo que ya no está no es un error**: pasa con
 * un doble clic o con dos pestañas abiertas, y la respuesta correcta es que
 * el carrito quede sin eso, que es como ya está.
 */
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

/**
 * Vaciar. Se van los renglones y el carrito queda: es uno por usuario
 * (§5.5), y borrarlo solo obligaría a crearlo de nuevo en el próximo agregar.
 */
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
