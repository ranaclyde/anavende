import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { compare, type Money } from "@/lib/money";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";

/**
 * La revisión del carrito al abrirlo — FS RF-08, RN-09 · TS §5.5. Tarea F5.6.
 *
 * RF-08 pide que, al abrir el carrito, se lo compare con el catálogo y se le
 * diga al comprador qué cambió, «de forma explícita y no destructiva»:
 *
 *   · **El precio cambió** → queda el vigente, y se avisa «pasó de $A a $B».
 *     $A es `last_seen_price`; al avisar pasa a ser el vigente, y por eso el
 *     aviso sale UNA vez.
 *   · **Queda menos stock que lo pedido** → la cantidad baja a lo que queda, y
 *     se avisa. La próxima vez ya coinciden: tampoco se repite.
 *
 * Lo que NO toca, a propósito:
 *
 *   · **Sin stock**: el renglón queda como está, marcado y fuera del total
 *     (`leerCarrito`). Bajarlo a cero no se puede —el CHECK exige cantidad
 *     positiva— y borrarlo sería destructivo: el comprador puede querer
 *     esperar a que vuelva.
 *   · **Desactivado**: queda apartado en «Ya no disponible» hasta que el
 *     comprador lo quite. Ese renglón a la vista ES el aviso persistente que
 *     pide RF-08 (decisión del 2026-09-12, variante B).
 *
 * **Escribe mientras se arma la página**, y no es un descuido: la revisión es
 * exactamente lo que RF-08 dice que pasa «al abrir el carrito», y hacerla en
 * una acción aparte obligaría a mostrar primero un carrito sin revisar y
 * después corregirlo en pantalla. Es idempotente —una segunda pasada no
 * encuentra nada que cambiar—, así que una recarga o un `refresh()` no hacen
 * daño: solo dejan de mostrar avisos que ya se vieron.
 *
 * **Bloquea la fila del carrito**, igual que agregar y cambiar la cantidad: si
 * no, un «+» que llega en medio de la revisión podría pisar la cantidad recién
 * ajustada con una leída antes.
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

    // Solo lo que se vende: lo desactivado queda apartado y no se revisa. El
    // `greatest(…, 0)` es RF-24: un total negativo es una discrepancia de la
    // vendedora, y para quien compra es lo mismo que cero.
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
          LEFT JOIN colors co     ON co.id = v.color_id
         WHERE ci.cart_id = ${carrito.id}
           AND v.is_active AND p.is_active
         ORDER BY ci.added_at, ci.id`)),
    ];

    const avisos: Aviso[] = [];

    for (const f of filas) {
      const cambioElPrecio = compare(f.visto, f.vigente) !== 0;
      // Sin stock no se ajusta: queda marcado, y el tope sería cero.
      const tope = Math.min(f.disponible, TOPE_POR_ITEM);
      const hayQueAjustar = f.disponible > 0 && f.cantidad > tope;

      if (!cambioElPrecio && !hayQueAjustar) continue;

      await tx.execute(sql`
        UPDATE cart_items
           SET last_seen_price = ${f.vigente},
               quantity        = ${hayQueAjustar ? tope : f.cantidad}
         WHERE cart_id = ${carrito.id} AND variant_id = ${f.variantId}`);

      // El color va en el nombre: con dos colores del mismo producto en el
      // carrito, «el precio de Teclado K120 cambió» no dice cuál.
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
