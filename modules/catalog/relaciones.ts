import "server-only";

import { sql } from "drizzle-orm";

import type { db } from "@/db";
import { domainError } from "@/lib/errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Categorías relacionadas — RF-31, TS §11.1.
 *
 * Se guarda **una fila por sentido** (§5.4): «Teclados → Pads» y «Pads →
 * Teclados» son dos filas, y la recíproca lleva `is_reciprocal` en las dos.
 * Así la consulta de recomendados (§11.2), que corre en cada ficha, es un
 * `WHERE category_id = $1` sobre la clave primaria, y la reciprocidad se paga
 * acá, al escribir, que es lo raro.
 *
 * La invariante que esto sostiene: **una fila recíproca siempre tiene la del
 * otro sentido, recíproca también**. Una dirigida («Notebooks → Fundas») es
 * de su categoría y nada más: puede haber otra dirigida de vuelta, cargada a
 * propósito desde la otra, y cada una se quita sin tocar a la otra. Toda
 * escritura pasa por `guardarRelaciones`, que es la que la mantiene.
 */

export type RelacionPedida = { id: string; reciproca: boolean };

/**
 * Reemplaza las relacionadas de `categoriaId` por `lista`, en ese orden.
 *
 * Lo que cambia del otro lado, según RF-31:
 *   · una relación **nueva o que pasa a recíproca** crea la inversa al final
 *     de la lista de la otra categoría —o la marca recíproca si ya estaba
 *     como dirigida, sin moverla de su lugar—;
 *   · una que **pasa a dirigida** borra la inversa;
 *   · **quitar** una recíproca la quita en los dos sentidos; una dirigida,
 *     solo en el suyo.
 *
 * Va dentro de la transacción de quien llama: el alta y la edición guardan el
 * nombre y las relaciones juntos, o nada.
 */
export async function guardarRelaciones(
  tx: Tx,
  categoriaId: string,
  lista: RelacionPedida[],
): Promise<void> {
  if (lista.some((r) => r.id === categoriaId)) {
    throw domainError("VALIDATION", {
      message: "Una categoría no puede estar relacionada consigo misma.",
    });
  }

  const actuales = await tx.execute<{ id: string; reciproca: boolean }>(sql`
    SELECT related_category_id AS id, is_reciprocal AS reciproca
      FROM category_relations
     WHERE category_id = ${categoriaId}`);
  const yaEstaban = new Map(actuales.map((r) => [r.id, r.reciproca]));
  const pedidas = new Set(lista.map((r) => r.id));

  // Una categoría inactiva no se puede AGREGAR —el selector ya no la ofrece—,
  // pero una relación que ya estaba se conserva aunque la otra se haya
  // desactivado después: deja de aportar productos sin romper nada (RF-31), y
  // al reactivarla vuelve a funcionar sin que nadie tenga que recordarla.
  const nuevas = lista.filter((r) => !yaEstaban.has(r.id)).map((r) => r.id);
  if (nuevas.length) {
    const [{ validas }] = await tx.execute<{ validas: number }>(sql`
      SELECT count(*)::int AS validas
        FROM categories
       WHERE id IN (${sql.join(
         nuevas.map((id) => sql`${id}`),
         sql`, `,
       )})
         AND is_active`);
    if (validas !== nuevas.length) {
      throw domainError("VALIDATION", {
        message:
          "Una de las categorías elegidas está inactiva o ya no existe. Volvé a abrir la categoría y elegí de nuevo.",
      });
    }
  }

  // ── Las que se quitaron ──
  for (const [id, reciproca] of yaEstaban) {
    if (pedidas.has(id)) continue;
    await tx.execute(sql`
      DELETE FROM category_relations
       WHERE category_id = ${categoriaId} AND related_category_id = ${id}`);
    if (reciproca) await borrarInversa(tx, categoriaId, id);
  }

  // ── Las que quedan, en el orden pedido ──
  for (const [orden, { id, reciproca }] of lista.entries()) {
    await tx.execute(sql`
      INSERT INTO category_relations
             (category_id, related_category_id, is_reciprocal, sort_order)
      VALUES (${categoriaId}, ${id}, ${reciproca}, ${orden})
      ON CONFLICT (category_id, related_category_id)
      DO UPDATE SET is_reciprocal = EXCLUDED.is_reciprocal,
                    sort_order    = EXCLUDED.sort_order`);

    if (!reciproca) {
      // Solo si ERA recíproca: la inversa es suya y se va con ella. Una
      // dirigida nueva no toca nada del otro lado, aunque allá haya otra
      // dirigida de vuelta —esa la cargó alguien a propósito, en la otra
      // categoría, y no es de esta—.
      if (yaEstaban.get(id) === true) {
        await borrarInversa(tx, categoriaId, id);
      }
      continue;
    }

    // La inversa entra ÚLTIMA en la lista de la otra: el orden de esa lista
    // lo decidió quien la armó, y una relación que llega desde afuera no
    // tiene por qué pasarle adelante a las que eligió a mano. Si ya existía
    // —como dirigida desde el otro lado—, se queda donde estaba.
    await tx.execute(sql`
      INSERT INTO category_relations
             (category_id, related_category_id, is_reciprocal, sort_order)
      VALUES (${id}, ${categoriaId}, true,
              (SELECT COALESCE(max(sort_order) + 1, 0)
                 FROM category_relations WHERE category_id = ${id}))
      ON CONFLICT (category_id, related_category_id)
      DO UPDATE SET is_reciprocal = true`);
  }
}

async function borrarInversa(tx: Tx, categoriaId: string, otraId: string) {
  await tx.execute(sql`
    DELETE FROM category_relations
     WHERE category_id = ${otraId} AND related_category_id = ${categoriaId}`);
}
