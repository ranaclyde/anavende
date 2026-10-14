import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  leerCompletaTuSetup,
  leerRecomendados,
} from "@/modules/catalog/products/recomendados";
import { enTransaccionRevertida, type Tx } from "@/tests/apoyo/transaccion";

/**
 * F8.2 y F8.3 — RF-32, TS §11.2: los dos bloques de recomendados de la ficha
 * y «Completá tu setup» del carrito.
 *
 * Lo que se prueba es el ORDEN, porque es lo único que puede salir mal en
 * silencio: un bloque con los productos correctos en el orden equivocado no
 * da error, muestra un agotado donde había uno con stock, o un teclado en
 * «También te puede interesar» de otro teclado.
 *
 * **Cada test apaga los destacados de la base adentro de su transacción.** El
 * nivel 2 de los complementos son los destacados de TODO el catálogo, y la
 * base de desarrollo tiene los del seed: sin esto, el resultado dependería de
 * con qué se sembró la última vez. Se revierte con el resto.
 */

/** La variante de un producto de prueba: el carrito guarda variantes. */
async function varianteDe(tx: Tx, productoId: string): Promise<string> {
  const [f] = await tx.execute<{ id: string }>(sql`
    SELECT id FROM product_variants WHERE product_id = ${productoId}`);
  return f.id;
}

/** Los nombres que se crearon, para leer el resultado sin mirar ids. */
const nombres = (lista: { nombre: string }[]) => lista.map((p) => p.nombre);

async function preparar(tx: Tx) {
  await tx.execute(sql`UPDATE products SET is_featured = false`);
  const sufijo = randomUUID().slice(0, 8);
  // `now()` es el mismo para toda la transacción: sin fechas a mano, «más
  // recientes» empataría siempre y decidiría el id, que es al azar.
  let minuto = 0;

  const marca = async (nombre: string) => {
    const [f] = await tx.execute<{ id: string }>(sql`
      INSERT INTO brands (name, slug)
      VALUES (${`${nombre} ${sufijo}`}, ${`${nombre}-${sufijo}`.toLowerCase()})
      RETURNING id`);
    return f.id;
  };

  const categoria = async (nombre: string) => {
    const [f] = await tx.execute<{ id: string }>(sql`
      INSERT INTO categories (name, slug)
      VALUES (${`${nombre} ${sufijo}`}, ${`${nombre}-${sufijo}`.toLowerCase()})
      RETURNING id`);
    return f.id;
  };

  const producto = async (
    nombre: string,
    d: {
      categoria: string;
      marca: string;
      precio?: number;
      stock?: number;
      destacado?: boolean;
      activo?: boolean;
    },
  ) => {
    minuto += 1;
    const [f] = await tx.execute<{ id: string }>(sql`
      INSERT INTO products (name, slug, brand_id, category_id, price,
                            is_featured, is_active, created_at)
      VALUES (${nombre}, ${`${nombre}-${sufijo}`.toLowerCase()},
              ${d.marca}, ${d.categoria}, ${(d.precio ?? 1000).toFixed(2)},
              ${d.destacado ?? false}, ${d.activo ?? true},
              now() + make_interval(mins => ${minuto}))
      RETURNING id`);
    await tx.execute(sql`
      INSERT INTO product_variants (product_id, stock_total)
      VALUES (${f.id}, ${d.stock ?? 5})`);
    return f.id;
  };

  const relacionar = async (desde: string, hacia: string[]) => {
    for (const [i, otra] of hacia.entries()) {
      await tx.execute(sql`
        INSERT INTO category_relations
          (category_id, related_category_id, is_reciprocal, sort_order)
        VALUES (${desde}, ${otra}, false, ${i})`);
    }
  };

  return { marca, categoria, producto, relacionar };
}

describe("«También te puede interesar»", () => {
  test("las relacionadas en su orden, y después los destacados con stock", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const teclados = await categoria("Teclados");
      const pads = await categoria("Pads");
      const mouses = await categoria("Mouses");
      const cables = await categoria("Cables");
      await relacionar(teclados, [pads, mouses]);

      const k120 = await producto("K120", { categoria: teclados, marca: m });
      await producto("Mouse", { categoria: mouses, marca: m });
      await producto("Pad", { categoria: pads, marca: m });
      await producto("Cable", { categoria: cables, marca: m, destacado: true });
      // Destacado pero sin stock: el nivel 2 es «destacados CON stock».
      await producto("Cable agotado", {
        categoria: cables,
        marca: m,
        destacado: true,
        stock: 0,
      });

      const { complementos } = await leerRecomendados(k120, tx);

      // Pads va antes que Mouses porque así se ordenó la relación (RF-31).
      expect(nombres(complementos.productos)).toEqual([
        "Pad",
        "Mouse",
        "Cable",
      ]);
    }));

  test("un agotado de una relacionada sólo entra si no alcanza el cupo", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const teclados = await categoria("Teclados");
      const pads = await categoria("Pads");
      const cables = await categoria("Cables");
      await relacionar(teclados, [pads]);

      const k120 = await producto("K120", { categoria: teclados, marca: m });
      await producto("Pad agotado", { categoria: pads, marca: m, stock: 0 });
      await producto("Cable", { categoria: cables, marca: m, destacado: true });

      const { complementos } = await leerRecomendados(k120, tx);

      expect(nombres(complementos.productos)).toEqual(["Cable", "Pad agotado"]);
    }));

  test("nunca el producto actual, un inactivo ni uno de la misma categoría", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const teclados = await categoria("Teclados");
      const pads = await categoria("Pads");
      await relacionar(teclados, [pads]);

      const k120 = await producto("K120", {
        categoria: teclados,
        marca: m,
        destacado: true,
      });
      await producto("Pad", { categoria: pads, marca: m });
      await producto("Pad inactivo", {
        categoria: pads,
        marca: m,
        activo: false,
      });
      // Un destacado del mismo rubro es una alternativa, no un complemento.
      await producto("K380", {
        categoria: teclados,
        marca: m,
        destacado: true,
      });

      const { complementos, similares } = await leerRecomendados(k120, tx);

      expect(nombres(complementos.productos)).toEqual(["Pad"]);
      expect(nombres(similares)).toContain("K380");
    }));

  test("no pasa de cuatro, y sin candidatos queda vacío", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const teclados = await categoria("Teclados");
      const pads = await categoria("Pads");
      const solo = await categoria("Solo");
      await relacionar(teclados, [pads]);

      const k120 = await producto("K120", { categoria: teclados, marca: m });
      for (let i = 1; i <= 6; i++) {
        await producto(`Pad ${i}`, { categoria: pads, marca: m });
      }
      const suelto = await producto("Suelto", {
        categoria: solo,
        marca: await marca("Otra"),
      });

      expect(
        (await leerRecomendados(k120, tx)).complementos.productos,
      ).toHaveLength(4);
      expect(await leerRecomendados(suelto, tx)).toEqual({
        complementos: { productos: [], categorias: [] },
        similares: [],
      });
    }));
});

describe("«También te puede interesar», uno de cada relacionada", () => {
  test("por vueltas: el mejor de cada una, y la cuarta de la primera", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const auris = await categoria("Auris");
      const mouses = await categoria("Mouses");
      const micros = await categoria("Micros");
      const teclados = await categoria("Teclados");
      await relacionar(auris, [mouses, micros, teclados]);

      const h350 = await producto("H350", { categoria: auris, marca: m });
      for (const n of ["A", "B", "C"]) {
        await producto(`Mouse ${n}`, { categoria: mouses, marca: m });
      }
      await producto("Micro", { categoria: micros, marca: m });
      await producto("Teclado A", { categoria: teclados, marca: m });
      await producto("Teclado B", { categoria: teclados, marca: m });

      const { complementos } = await leerRecomendados(h350, tx);

      // Antes eran los cuatro primeros mouses: Micros y Teclados no salían.
      expect(nombres(complementos.productos)).toEqual([
        "Mouse C",
        "Micro",
        "Teclado B",
        "Mouse B",
      ]);
      // «Ver todo» lleva a las tres, en el orden de la relación.
      expect(complementos.categorias.map((c) => c.id)).toEqual([
        mouses,
        micros,
        teclados,
      ]);
    }));

  test("con más de cuatro, una por relacionada, hasta ocho", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const base = await categoria("Base");
      const otras: string[] = [];
      for (let i = 1; i <= 10; i++) otras.push(await categoria(`Rel ${i}`));

      const seis = await producto("Con seis", { categoria: base, marca: m });
      for (const [i, c] of otras.entries()) {
        await producto(`P${i + 1} uno`, { categoria: c, marca: m });
        await producto(`P${i + 1} dos`, { categoria: c, marca: m });
      }

      await relacionar(base, otras.slice(0, 6));
      const conSeis = (await leerRecomendados(seis, tx)).complementos;
      expect(nombres(conSeis.productos)).toEqual(
        [1, 2, 3, 4, 5, 6].map((i) => `P${i} dos`),
      );

      // Diez relacionadas: el tope de RF-32 son ocho.
      await tx.execute(
        sql`DELETE FROM category_relations WHERE category_id = ${base}`,
      );
      await relacionar(base, otras);
      const conDiez = (await leerRecomendados(seis, tx)).complementos;
      expect(conDiez.productos).toHaveLength(8);
      expect(conDiez.categorias).toHaveLength(10);
    }));
});

describe("«Productos similares»", () => {
  test("precio parecido, después la categoría, después la marca", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto } = await preparar(tx);
      const logi = await marca("Logi");
      const otra = await marca("Otra");
      const teclados = await categoria("Teclados");
      const mouses = await categoria("Mouses");

      const k120 = await producto("K120", {
        categoria: teclados,
        marca: logi,
        precio: 10000,
      });
      await producto("Mouse Logi", { categoria: mouses, marca: logi });
      await producto("Caro", {
        categoria: teclados,
        marca: otra,
        precio: 30000,
      });
      // 7.000 y 13.000 son los bordes del ±30%: entran.
      await producto("Borde bajo", {
        categoria: teclados,
        marca: otra,
        precio: 7000,
      });
      await producto("Borde alto", {
        categoria: teclados,
        marca: otra,
        precio: 13000,
      });

      const { similares } = await leerRecomendados(k120, tx);

      // Dentro del nivel, los más nuevos primero.
      expect(nombres(similares)).toEqual([
        "Borde alto",
        "Borde bajo",
        "Caro",
        "Mouse Logi",
      ]);
    }));

  test("un agotado va al final aunque su nivel sea mejor", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto } = await preparar(tx);
      const logi = await marca("Logi");
      const teclados = await categoria("Teclados");
      const mouses = await categoria("Mouses");

      const k120 = await producto("K120", { categoria: teclados, marca: logi });
      await producto("K380 agotado", {
        categoria: teclados,
        marca: logi,
        stock: 0,
      });
      await producto("Mouse Logi", { categoria: mouses, marca: logi });

      const { similares } = await leerRecomendados(k120, tx);

      expect(nombres(similares)).toEqual(["Mouse Logi", "K380 agotado"]);
    }));

  test("lo que ya salió arriba no se repite abajo", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const logi = await marca("Logi");
      const teclados = await categoria("Teclados");
      const mouses = await categoria("Mouses");
      await relacionar(teclados, [mouses]);

      const k120 = await producto("K120", { categoria: teclados, marca: logi });
      // Relacionada Y de la misma marca: candidata en los dos bloques.
      await producto("Mouse Logi", { categoria: mouses, marca: logi });

      const { complementos, similares } = await leerRecomendados(k120, tx);

      expect(nombres(complementos.productos)).toEqual(["Mouse Logi"]);
      expect(similares).toEqual([]);
    }));
});

describe("«Completá tu setup»", () => {
  test("las relacionadas de todo el carrito, y después los destacados", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const teclados = await categoria("Teclados");
      const auris = await categoria("Auris");
      const pads = await categoria("Pads");
      const soportes = await categoria("Soportes");
      const cables = await categoria("Cables");
      await relacionar(teclados, [pads]);
      await relacionar(auris, [soportes]);

      const k120 = await producto("K120", { categoria: teclados, marca: m });
      const h350 = await producto("H350", { categoria: auris, marca: m });
      await producto("Soporte", { categoria: soportes, marca: m });
      await producto("Pad", { categoria: pads, marca: m });
      await producto("Cable", { categoria: cables, marca: m, destacado: true });

      const setup = await leerCompletaTuSetup(
        [await varianteDe(tx, k120), await varianteDe(tx, h350)],
        tx,
      );

      // Pad y Soporte están las dos primeras en su relación: empatan en
      // prioridad y desempata el más nuevo.
      expect(nombres(setup.productos)).toEqual(["Pad", "Soporte", "Cable"]);
    }));

  test("nada de lo que está en el carrito, ni de sus categorías", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const teclados = await categoria("Teclados");
      const mouses = await categoria("Mouses");
      const pads = await categoria("Pads");
      await relacionar(teclados, [mouses, pads]);

      const k120 = await producto("K120", { categoria: teclados, marca: m });
      const g203 = await producto("G203", { categoria: mouses, marca: m });
      await producto("G502", { categoria: mouses, marca: m });
      await producto("K380", {
        categoria: teclados,
        marca: m,
        destacado: true,
      });
      await producto("Pad", { categoria: pads, marca: m });

      const setup = await leerCompletaTuSetup(
        [await varianteDe(tx, k120), await varianteDe(tx, g203)],
        tx,
      );

      expect(nombres(setup.productos)).toEqual(["Pad"]);
    }));

  test("las relacionadas se reparten por vueltas, como en la ficha", () =>
    enTransaccionRevertida(async (tx) => {
      const { marca, categoria, producto, relacionar } = await preparar(tx);
      const m = await marca("Marca");
      const teclados = await categoria("Teclados");
      const mouses = await categoria("Mouses");
      const pads = await categoria("Pads");
      await relacionar(teclados, [mouses, pads]);

      const k120 = await producto("K120", { categoria: teclados, marca: m });
      for (const n of ["A", "B", "C"]) {
        await producto(`Mouse ${n}`, { categoria: mouses, marca: m });
      }
      await producto("Pad", { categoria: pads, marca: m });

      const setup = await leerCompletaTuSetup([await varianteDe(tx, k120)], tx);

      expect(nombres(setup.productos)).toEqual([
        "Mouse C",
        "Pad",
        "Mouse B",
        "Mouse A",
      ]);
      expect(setup.categorias.map((c) => c.id)).toEqual([mouses, pads]);
    }));

  test("con el carrito vacío no hay bloque", async () => {
    expect(await leerCompletaTuSetup([])).toEqual({
      productos: [],
      categorias: [],
    });
  });
});
