import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { escribirTextoLegal, leerTextoLegal } from "@/modules/content/legales";
import { sanitizarMarkdown } from "@/modules/content/markdown";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";
import { textoLegal } from "@/modules/content/schemas";

/**
 * F9.3 — RF-29, §16.
 *
 * Como el de configuración, escribe de verdad: `escribirTextoLegal` abre su
 * propia conexión y una transacción de test no la vería. Se guarda el texto
 * de «Cómo comprar» antes y se repone al final.
 */

const valido = (entrada: unknown) => textoLegal.safeParse(entrada);

describe("las páginas que crea la migración", () => {
  test.each(PAGINAS_LEGALES.map((p) => p.slug))(
    "«%s» existe y su texto ya es Markdown de la lista blanca",
    async (slug) => {
      const texto = await leerTextoLegal(slug);

      expect(texto).not.toBeNull();
      // Lo que sembró la migración es lo mismo que el sanitizador dejaría:
      // la primera vez que la vendedora guarde sin tocar nada, no cambia.
      expect(sanitizarMarkdown(texto!.contenido)).toBe(texto!.contenido);
    },
  );

  test("«Garantías y devoluciones» dice cómo arrepentirse (RF-29)", async () => {
    const texto = await leerTextoLegal("garantias");
    expect(texto!.contenido).toContain("Cómo arrepentirte de una compra");
    expect(texto!.contenido).toContain("Mis compras");
  });

  test("«Privacidad» nombra lo que se guarda en el navegador", async () => {
    const { contenido } = (await leerTextoLegal("privacidad"))!;
    for (const cookie of [
      "sesión",
      "compra pendiente",
      "Vistos recientemente",
    ]) {
      expect(contenido).toContain(cookie);
    }
  });
});

describe("la validación al guardar", () => {
  test("sanitiza: un enlace pierde el enlace y conserva las palabras", () => {
    const r = valido({
      slug: "terminos",
      contenido: "Mirá [esta página](https://ejemplo.com)",
    });
    expect(r.data?.contenido).toBe("Mirá esta página");
  });

  test("no deja una página vacía", () => {
    expect(valido({ slug: "terminos", contenido: "" }).success).toBe(false);
    // Lo que solo tenía una imagen queda vacío después de sanitizar.
    expect(
      valido({ slug: "terminos", contenido: "![x](https://e.com/a.png)" })
        .success,
    ).toBe(false);
  });

  test("solo acepta las cuatro páginas", () => {
    expect(valido({ slug: "otra", contenido: "Hola" }).success).toBe(false);
  });

  test("el límite pasa de 5.000: una política de privacidad no entra", () => {
    const largo = "a".repeat(10_000);
    expect(valido({ slug: "privacidad", contenido: largo }).success).toBe(true);
    expect(
      valido({ slug: "privacidad", contenido: "a".repeat(15_001) }).success,
    ).toBe(false);
  });
});

describe("escribir", () => {
  let previa: { content: string; updated_at: Date } | undefined;

  beforeAll(async () => {
    [previa] = await db.execute<{ content: string; updated_at: Date }>(sql`
      SELECT content, updated_at FROM legal_pages WHERE slug = 'como-comprar'`);
  });

  afterAll(async () => {
    if (!previa) return;
    await db.execute(sql`
      UPDATE legal_pages
         SET content = ${previa.content}, updated_at = ${previa.updated_at}
       WHERE slug = 'como-comprar'`);
  });

  test("pisa el texto y mueve la fecha, sin tocar el título", async () => {
    const antes = (await leerTextoLegal("como-comprar"))!;

    await escribirTextoLegal({
      slug: "como-comprar",
      titulo: "Otro título que no se tiene que guardar",
      contenido: "Texto nuevo.",
    });

    const [fila] = await db.execute<{
      title: string;
      content: string;
      updated_at: Date;
    }>(sql`
      SELECT title, content, updated_at FROM legal_pages
       WHERE slug = 'como-comprar'`);

    expect(fila.content).toBe("Texto nuevo.");
    expect(fila.title).toBe("Cómo comprar");
    expect(new Date(fila.updated_at).getTime()).toBeGreaterThan(
      antes.actualizada.getTime(),
    );
  });
});
