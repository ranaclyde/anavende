import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  enTransaccionRevertida,
  rechaza,
  type Tx,
} from "@/tests/apoyo/transaccion";

/**
 * F2.1 — las reglas de RF-18 contra Postgres: los conteos del listado y la
 * invariante RN-11b.
 *
 * Migrado de `scripts/verificar-catalogo.mts` (F4.0b).
 *
 * No prueba las Server Actions —eso necesita sesión— sino las CONSULTAS que
 * las sostienen. Si el conteo de uso está mal, la regla que decide si una
 * marca se puede desactivar está mal, y eso no se ve leyendo el código.
 */

type Uso = { activos: number; total: number };

async function usoDeMarca(tx: Tx, id: string): Promise<Uso> {
  const [f] = await tx.execute<Uso>(sql`
    SELECT count(*) FILTER (WHERE is_active)::int AS activos,
           count(*)::int AS total
      FROM (SELECT is_active FROM products WHERE brand_id = ${id}) AS usos`);
  return f;
}

async function usoDeColor(tx: Tx, id: string): Promise<Uso> {
  const [f] = await tx.execute<Uso>(sql`
    SELECT count(*) FILTER (WHERE is_active)::int AS activos,
           count(*)::int AS total
      FROM (SELECT DISTINCT p.id, p.is_active
              FROM product_variants v
              JOIN products p ON p.id = v.product_id
             WHERE v.color_id = ${id}) AS usos`);
  return f;
}

/** La cadena mínima: marca, categoría y color, sin productos todavía. */
async function armarCatalogo(tx: Tx) {
  const [marca] = await tx.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug) VALUES ('Probando Marca', 'probando-marca')
    RETURNING id`);
  const [categoria] = await tx.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug) VALUES ('Probando Cat', 'probando-cat')
    RETURNING id`);
  const [color] = await tx.execute<{ id: string }>(sql`
    INSERT INTO colors (name, slug, hex_code)
    VALUES ('Probando Color', 'probando-color', '#112233') RETURNING id`);
  return { marca: marca.id, categoria: categoria.id, color: color.id };
}

async function unProducto(tx: Tx, marca: string, categoria: string) {
  const [p] = await tx.execute<{ id: string }>(sql`
    INSERT INTO products (name, slug, brand_id, category_id, price)
    VALUES ('Producto de prueba', 'producto-de-prueba', ${marca}, ${categoria}, 1000)
    RETURNING id`);
  return p.id;
}

describe("el uso de una marca (RN-11b)", () => {
  test("recién creada no la usa nadie", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca } = await armarCatalogo(tx);
      expect(await usoDeMarca(tx, marca)).toMatchObject({ total: 0 });
    });
  });

  test("con un producto activo cuenta 1 activo, y la base no deja borrarla", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria } = await armarCatalogo(tx);
      await unProducto(tx, marca, categoria);

      expect(await usoDeMarca(tx, marca)).toEqual({ activos: 1, total: 1 });

      // La restricción de la base tiene que impedirlo IGUAL, aunque la
      // aplicación ya lo haya rechazado antes: la pantalla es la primera
      // defensa, no la última.
      await rechaza(
        tx,
        (sp) => sp.execute(sql`DELETE FROM brands WHERE id = ${marca}`),
        /foreign key constraint/i,
      );
    });
  });

  test("con el producto desactivado se puede desactivar la marca, no borrarla", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria } = await armarCatalogo(tx);
      const producto = await unProducto(tx, marca, categoria);

      await tx.execute(
        sql`UPDATE products SET is_active = false WHERE id = ${producto}`,
      );

      // activos=0 habilita desactivar la marca; total=1 sigue impidiendo
      // borrarla. Son dos preguntas distintas y por eso el conteo es doble.
      expect(await usoDeMarca(tx, marca)).toEqual({ activos: 0, total: 1 });
    });
  });
});

describe("el uso de un color viaja por las variantes", () => {
  test("sigue el estado del producto al que cuelga", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria, color } = await armarCatalogo(tx);
      const producto = await unProducto(tx, marca, categoria);

      await tx.execute(
        sql`UPDATE products SET is_active = false WHERE id = ${producto}`,
      );
      await tx.execute(sql`
        INSERT INTO product_variants (product_id, color_id)
        VALUES (${producto}, ${color})`);

      expect(await usoDeColor(tx, color)).toEqual({ activos: 0, total: 1 });

      await tx.execute(
        sql`UPDATE products SET is_active = true WHERE id = ${producto}`,
      );
      expect(await usoDeColor(tx, color)).toMatchObject({ activos: 1 });
    });
  });
});

describe("unicidad del nombre", () => {
  test("es única sin distinguir mayúsculas", async () => {
    await enTransaccionRevertida(async (tx) => {
      await armarCatalogo(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            INSERT INTO brands (name, slug) VALUES ('PROBANDO MARCA', 'otro-slug')`),
        /duplicate key|unique constraint/i,
      );
    });
  });
});

describe("categorías destacadas (RF-18)", () => {
  test("una categoría nueva NO nace destacada", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { categoria } = await armarCatalogo(tx);
      const [f] = await tx.execute<{ destacada: boolean }>(sql`
        SELECT is_featured AS destacada FROM categories WHERE id = ${categoria}`);
      expect(f.destacada).toBe(false);
    });
  });

  test("destacada e inactiva conviven: destacar no publica", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { categoria } = await armarCatalogo(tx);

      await tx.execute(sql`
        UPDATE categories SET is_featured = true, is_active = false
         WHERE id = ${categoria}`);

      // `is_active` es la única verdad sobre la visibilidad. Si destacar
      // publicara de paso, destacar una categoría a medio armar la mostraría.
      const [f] = await tx.execute<{ destacada: boolean; activa: boolean }>(sql`
        SELECT is_featured AS destacada, is_active AS activa
          FROM categories WHERE id = ${categoria}`);
      expect(f).toEqual({ destacada: true, activa: false });
    });
  });

  test("orden público: destacadas primero, y entre ellas por nombre", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { categoria } = await armarCatalogo(tx);
      await tx.execute(
        sql`UPDATE categories SET is_featured = true WHERE id = ${categoria}`,
      );

      // Los nombres contradicen a propósito al orden alfabético puro: «Zzz»
      // destacada tiene que salir antes que «Aaa» sin destacar. Con tres
      // nombres cualesquiera el resultado podría salir bien de casualidad.
      await tx.execute(sql`
        INSERT INTO categories (name, slug, is_featured) VALUES
          ('Zzz Ultima', 'zzz-ultima', true),
          ('Aaa Primera', 'aaa-primera', false)`);

      const orden = await tx.execute<{ name: string }>(sql`
        SELECT name FROM categories
         WHERE is_active AND slug IN ('probando-cat', 'zzz-ultima', 'aaa-primera')
         ORDER BY is_featured DESC, immutable_unaccent(lower(name))`);

      expect(orden.map((f) => f.name)).toEqual([
        "Probando Cat",
        "Zzz Ultima",
        "Aaa Primera",
      ]);
    });
  });
});

describe("el listado de marcas", () => {
  test("trae los conteos separados, y como números", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria } = await armarCatalogo(tx);
      await unProducto(tx, marca, categoria);

      const listado = await tx.execute<{
        id: string;
        activos: number;
        inactivos: number;
      }>(sql`
        SELECT b.id,
               count(p.id) FILTER (WHERE p.is_active)::int     AS activos,
               count(p.id) FILTER (WHERE NOT p.is_active)::int AS inactivos
          FROM brands b
          LEFT JOIN products p ON p.brand_id = b.id
         GROUP BY b.id
         ORDER BY immutable_unaccent(lower(b.name))`);

      expect(listado.find((f) => f.id === marca)).toMatchObject({
        activos: 1,
        inactivos: 0,
      });

      // El `::int` del SELECT es lo que se está probando: sin él, `count()`
      // llega como `bigint`, y el driver lo entrega COMO TEXTO. La pantalla
      // sumaría "1" + "2" = "12" sin que nada falle.
      expect(listado.every((f) => typeof f.activos === "number")).toBe(true);
    });
  });
});
