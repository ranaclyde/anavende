import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
  crearProducto,
  editarProducto,
} from "@/modules/catalog/products/schemas";
import {
  enTransaccionRevertida,
  rechaza,
  type Tx,
} from "@/tests/apoyo/transaccion";

/**
 * F2.3 — las reglas que no se ven leyendo el código: RN-04b sobre los dos
 * campos a la vez, la sanitización como parte de la validación, y RN-11b al
 * revés (no activar un producto de marca o categoría inactiva).
 *
 * Migrado de `scripts/verificar-productos.mts` (F4.0b).
 */

const base = {
  name: "Teclado mecánico K120",
  brandId: crypto.randomUUID(),
  categoryId: crypto.randomUUID(),
};

/** El primer mensaje colgado de un campo, tal como lo lee `lib/form.ts`. */
function errorDe(resultado: z.ZodSafeParseResult<unknown>, campo: string) {
  if (resultado.success) return null;
  const arbol = z.treeifyError(resultado.error) as {
    properties?: Record<string, { errors?: string[] }>;
  };
  return arbol.properties?.[campo]?.errors?.[0] ?? null;
}

describe("el precio (RF-15)", () => {
  test("con coma decimal se acepta y se normaliza a punto", () => {
    const r = crearProducto.safeParse({ ...base, price: "1000,50" });
    expect(r.success && r.data.price).toBe("1000.50");
  });

  test("sin descuento, el descuento es cero: no hay oferta (RN-04b)", () => {
    // Que sea "0.00" y no `null` ni `undefined` es lo que deja a la vista
    // que «sin oferta» es un valor y no un hueco.
    const r = crearProducto.safeParse({ ...base, price: "1000,50" });
    expect(r.success && r.data.discount).toBe("0.00");
  });

  test.each([
    ["cero", "0"],
    ["negativo", "-5"],
    ["que no es un monto", "diez mil"],
  ])("un precio %s se rechaza", (_caso, price) => {
    expect(errorDe(crearProducto.safeParse({ ...base, price }), "price")).not.toBeNull();
  });
});

describe("el descuento, que necesita mirar el precio (RN-04b)", () => {
  test("IGUAL al precio se rechaza, y el error queda en el descuento", () => {
    const r = crearProducto.safeParse({ ...base, price: "1000", discount: "1000" });
    expect(errorDe(r, "discount")).toBe(
      "El descuento tiene que ser menor que el precio.",
    );
    // El precio NO se marca: marcar los dos campos manda a corregir uno que
    // está bien, y la vendedora no tiene forma de saber cuál de los dos era.
    expect(errorDe(r, "price")).toBeNull();
  });

  test("MAYOR al precio se rechaza", () => {
    const r = crearProducto.safeParse({ ...base, price: "1000", discount: "1500" });
    expect(errorDe(r, "discount")).not.toBeNull();
  });

  test("negativo se rechaza", () => {
    const r = crearProducto.safeParse({ ...base, price: "1000", discount: "-1" });
    expect(errorDe(r, "discount")).not.toBeNull();
  });

  test("de un centavo menos que el precio se acepta", () => {
    expect(
      crearProducto.safeParse({ ...base, price: "1000", discount: "999.99" })
        .success,
    ).toBe(true);
  });
});

describe("la descripción se sanitiza AL VALIDAR (§16)", () => {
  test("sale sanitizada de la validación, no de un paso aparte", () => {
    // Que sea el MISMO paso importa: un saneo posterior es un paso que algún
    // camino del código puede saltearse, y basta con uno.
    const r = crearProducto.safeParse({
      ...base,
      price: "1000",
      description:
        'Ver [manual](https://x.com) **acá**.\n\n<script>alert(1)</script>',
    });
    expect(r.success && r.data.description).toBe("Ver manual **acá**.");
  });

  test("el límite cuenta el texto: poner en negrita no acerca al tope", () => {
    const largaEnMarkdown = "**" + "a".repeat(4999) + "**";
    expect(
      crearProducto.safeParse({
        ...base,
        price: "1000",
        description: largaEnMarkdown,
      }).success,
    ).toBe(true);
  });

  test("un texto de más de 5.000 caracteres se rechaza", () => {
    expect(
      errorDe(
        crearProducto.safeParse({
          ...base,
          price: "1000",
          description: "a".repeat(5001),
        }),
        "description",
      ),
    ).not.toBeNull();
  });

  test("una descripción vacía es válida (RF-15)", () => {
    expect(crearProducto.safeParse({ ...base, price: "1000" }).success).toBe(true);
  });
});

describe("editar exige `id`, y el resto de las reglas son las mismas", () => {
  test("sin `id` se rechaza", () => {
    expect(editarProducto.safeParse({ ...base, price: "1000" }).success).toBe(false);
  });

  test("con `id` y datos válidos se acepta", () => {
    expect(
      editarProducto.safeParse({
        ...base,
        id: crypto.randomUUID(),
        price: "1000",
      }).success,
    ).toBe(true);
  });
});

describe("RN-11b al revés: no activar contra algo inactivo", () => {
  async function marcaApagadaYCategoriaEncendida(tx: Tx) {
    const [marca] = await tx.execute<{ id: string }>(sql`
      INSERT INTO brands (name, slug, is_active)
      VALUES ('Probando Marca Off', 'probando-marca-off', false) RETURNING id`);
    const [categoria] = await tx.execute<{ id: string }>(sql`
      INSERT INTO categories (name, slug)
      VALUES ('Probando Cat On', 'probando-cat-on') RETURNING id`);
    return { marca: marca.id, categoria: categoria.id };
  }

  test("la consulta detecta la marca inactiva sin confundir la categoría", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria } = await marcaApagadaYCategoriaEncendida(tx);

      // Es la MISMA consulta que corre la Server Action. Una copia parecida
      // probaría otra cosa que se le da un aire.
      const [f] = await tx.execute<{ marca: boolean; categoria: boolean }>(sql`
        SELECT (SELECT NOT is_active FROM brands     WHERE id = ${marca})     AS marca,
               (SELECT NOT is_active FROM categories WHERE id = ${categoria}) AS categoria`);

      expect(f).toEqual({ marca: true, categoria: false });
    });
  });

  test("un producto INACTIVO de marca inactiva se guarda", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria } = await marcaApagadaYCategoriaEncendida(tx);

      // RN-11b solo prohíbe la combinación activo + inactivo. Guardar el
      // borrador tiene que poder: si no, no habría forma de preparar un
      // producto antes de activar su marca.
      const [p] = await tx.execute<{ isActive: boolean }>(sql`
        INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
        VALUES ('Probando Producto', 'probando-producto', ${marca}, ${categoria},
                '1000.00', false)
        RETURNING is_active AS "isActive"`);

      expect(p.isActive).toBe(false);
    });
  });

  test("la base rechaza un descuento igual al precio, aunque la validación falle", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria } = await marcaApagadaYCategoriaEncendida(tx);
      const [p] = await tx.execute<{ id: string }>(sql`
        INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
        VALUES ('Probando Producto', 'probando-producto', ${marca}, ${categoria},
                '1000.00', false)
        RETURNING id`);

      // El CHECK es la última barrera: la validación de Zod es la primera, y
      // entre las dos hay todo el código que puede equivocarse.
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`UPDATE products SET discount = price WHERE id = ${p.id}`),
        /discount_valid/i,
      );
    });
  });
});
