import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { compare, type Money } from "@/lib/money";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";

/**
 * La revisión del carrito al abrirlo (RF-08, RN-09): actualiza precios y baja
 * cantidades al stock que queda, y devuelve los avisos. Lo sin stock o
 * desactivado no se toca.
 *
 * Escribe mientras se arma la página, a propósito: es idempotente, así que una
 * recarga solo deja de mostrar avisos ya vistos. Bloquea la fila del carrito
 * para que un «+» en el medio no pise la cantidad recién ajustada.
 */

export type Aviso =
  | {
      tipo: "precio";
      variantId: string;
      nombre: string;
      antes: Money;
      ahora: Money;
    }
  | { tipo: "stock"; variantId: string; nombre: string; quedan: number };

type Fila = {
  variantId: string;
  nombre: string;
  colorNombre: string | null;
  visto: Money;
  vigente: Money;
  cantidad: number;
  disponible: number;
};

export async function revisarCarrito(userId: string): Promise<Aviso[]> {
  return db.transaction(async (tx) => {
    const [carrito] = await tx.execute<{ id: string }>(sql`
      SELECT id FROM carts WHERE user_id = ${userId} FOR UPDATE`);
    if (!carrito) return [];

    // Lo desactivado no se revisa. El `greatest(…, 0)`: un disponible negativo
    // (RF-24) es, para quien compra, lo mismo que cero.
    const filas = [
      ...(await tx.execute<Fila>(sql`
        SELECT ci.variant_id      AS "variantId",
               p.name             AS nombre,
               co.name            AS "colorNombre",
               ci.last_seen_price AS visto,
               p.final_price      AS vigente,
               ci.quantity        AS cantidad,
               greatest(v.stock_total - v.reserved_stock, 0)::int AS disponible
          FROM cart_items ci
          JOIN product_variants v ON v.id = ci.variant_id
          JOIN products p         ON p.id = v.product_id
          LEFT JOIN variant_colors co ON co.variant_id = v.id
         WHERE ci.cart_id = ${carrito.id}
           AND v.is_active AND p.is_active
         ORDER BY ci.added_at, ci.id`)),
    ];

    const avisos: Aviso[] = [];

    for (const f of filas) {
      const cambioElPrecio = compare(f.visto, f.vigente) !== 0;
      const tope = Math.min(f.disponible, TOPE_POR_ITEM);
      const hayQueAjustar = f.disponible > 0 && f.cantidad > tope;

      if (!cambioElPrecio && !hayQueAjustar) continue;

      await tx.execute(sql`
        UPDATE cart_items
           SET last_seen_price = ${f.vigente},
               quantity        = ${hayQueAjustar ? tope : f.cantidad}
         WHERE cart_id = ${carrito.id} AND variant_id = ${f.variantId}`);

      const nombre = f.colorNombre
        ? `${f.nombre} (${f.colorNombre.toLowerCase()})`
        : f.nombre;

      if (cambioElPrecio) {
        avisos.push({
          tipo: "precio",
          variantId: f.variantId,
          nombre,
          antes: f.visto,
          ahora: f.vigente,
        });
      }
      if (hayQueAjustar) {
        avisos.push({
          tipo: "stock",
          variantId: f.variantId,
          nombre,
          quedan: tope,
        });
      }
    }

    return avisos;
  });
}
