import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import type { SlugLegal } from "@/modules/content/paginas";

export type TextoLegal = {
  slug: SlugLegal;
  titulo: string;
  contenido: string;
  actualizada: Date;
};

/**
 * Con `cache` porque la página la lee para los metadatos y para el cuerpo.
 * `null` si falta la fila (la crea una migración): la página da 404.
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
 * UPSERT y no UPDATE: si la fila faltara, un UPDATE no tocaría nada y el panel
 * diría «guardado». Fuera de `actions.ts` para que el test corra esta
 * sentencia.
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
