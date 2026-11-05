import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { leerCategoriaConPagina } from "@/modules/catalog/products/categorias-de-la-tienda";
import {
  crearCategoria,
  editarCategoria,
  TOPE_DEL_TEXTO_DE_CATEGORIA,
} from "@/modules/catalog/schemas";

/**
 * F3.11 — el texto de la página de una categoría, y la lectura que decide si
 * la página existe.
 */

describe("el texto, al validarlo", () => {
  const id = randomUUID();

  test("vacío o con solo espacios es «sin texto», no una cadena vacía", () => {
    expect(
      crearCategoria.parse({ name: "Teclados", description: "   " }),
    ).toHaveProperty("description", null);
  });

  test("se guarda sin los espacios de los bordes", () => {
    const r = editarCategoria.parse({
      id,
      name: "Teclados",
      isFeatured: false,
      description: "  Mecánicos y de membrana.  ",
    });
    expect(r.description).toBe("Mecánicos y de membrana.");
  });

  test("sin el campo, la edición no lo toca", () => {
    const r = editarCategoria.parse({ id, name: "Teclados", isFeatured: true });
    expect(r.description).toBeUndefined();
  });

  test("tiene tope", () => {
    const largo = "a".repeat(TOPE_DEL_TEXTO_DE_CATEGORIA + 1);
    expect(
      crearCategoria.safeParse({ name: "Teclados", description: largo })
        .success,
    ).toBe(false);
  });
});

describe("la categoría de la página", () => {
  const T = `zzc${randomUUID().slice(0, 8)}`;
  const creadas: string[] = [];

  async function una(activa: boolean, texto: string | null) {
    const slug = `${T}-${creadas.length}`;
    const [fila] = await db.execute<{ id: string }>(sql`
      INSERT INTO categories (name, slug, is_active, description)
      VALUES (${`Rubro ${slug}`}, ${slug}, ${activa}, ${texto})
      RETURNING id`);
    creadas.push(fila.id);
    return slug;
  }

  afterAll(async () => {
    for (const id of creadas) {
      await db.execute(sql`DELETE FROM categories WHERE id = ${id}`);
    }
  });

  test("una activa tiene página, con su texto", async () => {
    const slug = await una(true, "Con y sin cable.");
    expect(await leerCategoriaConPagina(slug)).toEqual({
      slug,
      nombre: `Rubro ${slug}`,
      texto: "Con y sin cable.",
    });
  });

  test("una desactivada no: da 404, como un producto desactivado", async () => {
    expect(await leerCategoriaConPagina(await una(false, null))).toBeNull();
  });

  test("una que no existe, tampoco", async () => {
    expect(await leerCategoriaConPagina(`${T}-no-existe`)).toBeNull();
  });
});
