import "server-only";

import { sql } from "drizzle-orm";

import type { db } from "@/db";
import { domainError } from "@/lib/errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Una fila por sentido (TECHNICAL-SPEC §11.1). Invariante: una fila recíproca
// siempre tiene la del otro sentido, recíproca también. Una dirigida es solo de
// su categoría. Toda escritura pasa por `guardarRelaciones`, que la mantiene.

export type RelacionPedida = { id: string; reciproca: boolean };

/**
 * Reemplaza las relacionadas de `categoriaId` por `lista`, en ese orden, y
 * ajusta el otro sentido según RF-31. Va dentro de la transacción de quien llama.
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

  // Una inactiva no se puede agregar, pero una relación que ya estaba se
  // conserva: al reactivarla vuelve a funcionar (RF-31).
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

  for (const [id, reciproca] of yaEstaban) {
    if (pedidas.has(id)) continue;
    await tx.execute(sql`
      DELETE FROM category_relations
       WHERE category_id = ${categoriaId} AND related_category_id = ${id}`);
    if (reciproca) await borrarInversa(tx, categoriaId, id);
  }

  for (const [orden, { id, reciproca }] of lista.entries()) {
    await tx.execute(sql`
      INSERT INTO category_relations
             (category_id, related_category_id, is_reciprocal, sort_order)
      VALUES (${categoriaId}, ${id}, ${reciproca}, ${orden})
      ON CONFLICT (category_id, related_category_id)
      DO UPDATE SET is_reciprocal = EXCLUDED.is_reciprocal,
                    sort_order    = EXCLUDED.sort_order`);

    if (!reciproca) {
      // Solo si era recíproca: una dirigida de vuelta cargada desde la otra
      // categoría no es de esta y no se toca.
      if (yaEstaban.get(id) === true) {
        await borrarInversa(tx, categoriaId, id);
      }
      continue;
    }

    // La inversa entra última en la lista de la otra, para no pasarle adelante
    // a las que se eligieron a mano; si ya existía, se queda donde estaba.
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
