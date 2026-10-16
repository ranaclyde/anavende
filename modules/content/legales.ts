import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import type { SlugLegal } from "@/modules/content/paginas";

/**
 * Lectura y escritura de las páginas legales — RF-29, §5.9.
 *
 * Las cuatro filas las crea la migración `0020_paginas_legales` con un
 * borrador, así que en una base migrada siempre están. Igual se contesta
 * `null` si falta: la página da 404 en vez de caerse.
 */

export type TextoLegal = {
  slug: SlugLegal;
  titulo: string;
  contenido: string;
  actualizada: Date;
};

/**
 * Con `cache` porque la página la lee dos veces en el mismo pedido: una para
 * los metadatos y otra para el cuerpo.
 */
export const leerTextoLegal = cache(
  async (slug: SlugLegal): Promise<TextoLegal | null> => {
    const [fila] = await db.execute<TextoLegal>(sql`
      SELECT slug,
             title      AS titulo,
             content    AS contenido,
             updated_at AS actualizada
        FROM legal_pages
       WHERE slug = ${slug}`);

    return fila ? { ...fila, actualizada: new Date(fila.actualizada) } : null;
  },
);

/**
 * Un UPSERT y no un UPDATE, por la misma razón que la configuración del
 * sitio: si la fila faltara, un UPDATE no afectaría nada y el panel diría
 * «guardado» sin haber guardado. El título viene de `PAGINAS_LEGALES` y no
 * se edita: es el nombre del enlace del pie.
 *
 * Vive fuera de `actions.ts` para que el test corra exactamente esta
 * sentencia; la acción pone el rol, la validación y la revalidación.
 */
export async function escribirTextoLegal(entrada: {
  slug: SlugLegal;
  titulo: string;
  contenido: string;
}): Promise<{ actualizada: Date }> {
  const [fila] = await db.execute<{ actualizada: Date }>(sql`
    INSERT INTO legal_pages (slug, title, content)
    VALUES (${entrada.slug}, ${entrada.titulo}, ${entrada.contenido})
    ON CONFLICT (slug) DO UPDATE
       SET content    = EXCLUDED.content,
           updated_at = now()
    RETURNING updated_at AS actualizada`);

  return { actualizada: new Date(fila.actualizada) };
}
