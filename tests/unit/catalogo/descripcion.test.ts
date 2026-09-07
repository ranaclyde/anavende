import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { enTransaccionRevertida, type Tx } from "@/tests/apoyo/transaccion";

/**
 * F2.3 — la mitad del «Hecho cuando» que vive en la base: buscar «cable hdmi»
 * encuentra un producto cuya descripción dice `Cable **HDMI** 2.1`.
 *
 * Migrado de `scripts/verificar-descripcion.mts` (F4.0b).
 *
 * Es la parte que no se ve leyendo el código. `description` guarda Markdown
 * (RF-15) y la sintaxis PARTE la subcadena —«**HDMI**» no contiene «cable
 * hdmi»—, así que la consulta de §10.1 mira `description_text`, la proyección
 * generada. Si esa columna o su índice se cayeran, la búsqueda seguiría
 * compilando y devolvería de menos: el peor modo de falla, porque no falla.
 */

const DESCRIPCION = [
  "Cable **HDMI** 2.1 de *alta* velocidad.",
  "",
  "## Qué trae",
  "",
  "- Conector USB-C reforzado",
  "- Modelo XT_500",
].join("\n");

async function unCableConDescripcion(tx: Tx) {
  const [marca] = await tx.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug) VALUES ('Probando HDMI', 'probando-hdmi')
    RETURNING id`);
  const [categoria] = await tx.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug) VALUES ('Probando Cables', 'probando-cables')
    RETURNING id`);

  const [producto] = await tx.execute<{ id: string; descriptionText: string }>(sql`
    INSERT INTO products (name, slug, description, brand_id, category_id, price)
    VALUES ('Cable de video', 'probando-cable-de-video', ${DESCRIPCION},
            ${marca.id}, ${categoria.id}, '9999.00')
    RETURNING id, description_text AS "descriptionText"`);

  return producto;
}

/**
 * La consulta de §10.1, recortada a lo que esta prueba mira.
 *
 * El término viaja como PARÁMETRO, nunca interpolado (§16) — y eso importa
 * incluso en un test: uno que interpolara estaría probando una consulta que
 * no es la que corre en producción.
 */
function buscar(tx: Tx, termino: string) {
  return tx.execute<{ id: string }>(sql`
    WITH q AS (SELECT immutable_unaccent(lower(${termino})) AS term)
    SELECT p.id
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      CROSS JOIN q
     WHERE p.is_active
       AND ( immutable_unaccent(lower(p.name))             ILIKE '%' || q.term || '%'
          OR immutable_unaccent(lower(b.name))             ILIKE '%' || q.term || '%'
          OR immutable_unaccent(lower(p.description_text)) ILIKE '%' || q.term || '%'
          OR immutable_unaccent(lower(p.name)) % q.term
          OR immutable_unaccent(lower(b.name)) % q.term )`);
}

describe("la proyección se calcula en la base, no en JavaScript", () => {
  test("`description_text` es una columna GENERADA", async () => {
    const [f] = await db.execute<{ is_generated: string }>(sql`
      SELECT is_generated
        FROM information_schema.columns
       WHERE table_name = 'products' AND column_name = 'description_text'`);
    expect(f?.is_generated).toBe("ALWAYS");
  });

  test("el índice trigrama está sobre la proyección, no sobre el Markdown", async () => {
    // Sobre `description` indexaría el texto que §10.1 ya no consulta: todo
    // el costo de escritura del índice, y ninguna lectura que lo use.
    const [f] = await db.execute<{ indexdef: string }>(sql`
      SELECT indexdef FROM pg_indexes
       WHERE indexname = 'products_description_trgm_idx'`);
    expect(f?.indexdef).toContain("description_text");
  });
});

describe("qué le queda al texto proyectado", () => {
  test("se queda sin la sintaxis de Markdown", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { descriptionText } = await unCableConDescripcion(tx);
      expect(descriptionText).not.toMatch(/[*#`]/);
    });
  });

  test("el guion sobrevive: «USB-C» sigue siendo «USB-C»", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { descriptionText } = await unCableConDescripcion(tx);
      expect(descriptionText).toContain("USB-C");
    });
  });

  test("el guion bajo se va, y eso solo afecta a la búsqueda", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { descriptionText } = await unCableConDescripcion(tx);
      expect(descriptionText).toContain("XT500");
    });
  });
});

describe("la búsqueda de §10.1", () => {
  test("«cable hdmi» encuentra `Cable **HDMI** 2.1`", async () => {
    await enTransaccionRevertida(async (tx) => {
      const producto = await unCableConDescripcion(tx);
      const encontrados = await buscar(tx, "cable hdmi");
      expect(encontrados.map((f) => f.id)).toContain(producto.id);
    });
  });

  test("la cursiva tampoco parte la subcadena", async () => {
    await enTransaccionRevertida(async (tx) => {
      const producto = await unCableConDescripcion(tx);
      const encontrados = await buscar(tx, "alta velocidad");
      expect(encontrados.map((f) => f.id)).toContain(producto.id);
    });
  });

  /**
   * La contraprueba, y es la que le da sentido a toda la columna: sobre
   * `description` la misma búsqueda NO encuentra nada. Si algún día alguien
   * devuelve la consulta al Markdown crudo, este test lo delata — sin él, los
   * dos de arriba seguirían en verde por el ILIKE sobre el nombre.
   */
  test("sobre `description` NO lo encontraría: por eso existe la proyección", async () => {
    await enTransaccionRevertida(async (tx) => {
      const producto = await unCableConDescripcion(tx);
      const [crudo] = await tx.execute<{ encuentra: boolean }>(sql`
        SELECT (immutable_unaccent(lower(description)) ILIKE '%cable hdmi%') AS encuentra
          FROM products WHERE id = ${producto.id}`);
      expect(crudo.encuentra).toBe(false);
    });
  });
});
