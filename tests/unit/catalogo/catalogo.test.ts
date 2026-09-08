import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  FILTROS_DE_TIENDA_VACIOS,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import { leerPaginaDelCatalogo } from "@/modules/catalog/products/tienda";

/**
 * F3.4 — RF-02, §10.1, §10.2.
 *
 * La consulta del catálogo se prueba contra Postgres de verdad porque lo que
 * hay que verificar es SQL: que dentro de un grupo las opciones se sumen, que
 * entre grupos se crucen, y que el rango de precio mire el precio FINAL y no
 * el de lista. Las tres son silenciosas — cuando fallan no hay error, hay una
 * grilla con productos de más o de menos.
 *
 * **Todos los casos llevan puesta la búsqueda por un token propio.** La base
 * de desarrollo tiene el catálogo sembrado y el de Ana, así que contar
 * resultados sin acotar a lo que este archivo creó daría números que dependen
 * de con qué se corrió el seed la última vez.
 */

const T = `zzt${randomUUID().slice(0, 8)}`;

const creados = {
  productos: [] as string[],
  marcas: [] as string[],
  categorias: [] as string[],
  colores: [] as string[],
};

async function unaMarca(nombre: string): Promise<string> {
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug)
    VALUES (${`${nombre} ${T}`}, ${`${nombre}-${T}`.toLowerCase()})
    RETURNING id`);
  creados.marcas.push(fila.id);
  return fila.id;
}

async function unaCategoria(nombre: string): Promise<string> {
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug)
    VALUES (${`${nombre} ${T}`}, ${`${nombre}-${T}`.toLowerCase()})
    RETURNING id`);
  creados.categorias.push(fila.id);
  return fila.id;
}

/** El nombre lleva sufijo: `colors_name_key` es único por `lower(name)`. */
async function unColor(nombre: string): Promise<string> {
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO colors (name, slug, hex_code)
    VALUES (${`${nombre} ${T}`}, ${`${nombre}-${T}`.toLowerCase()}, '#1c1e21')
    RETURNING id`);
  creados.colores.push(fila.id);
  return fila.id;
}

async function unProducto(p: {
  slug: string;
  marca: string;
  categoria: string;
  precio: string;
  descuento?: string;
  colores?: string[];
}): Promise<string> {
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO products (name, slug, brand_id, category_id, price, discount)
    VALUES (${`${T} ${p.slug}`}, ${`${T}-${p.slug}`},
            ${p.marca}, ${p.categoria}, ${p.precio}, ${p.descuento ?? "0.00"})
    RETURNING id`);
  creados.productos.push(fila.id);

  for (const colorId of p.colores ?? []) {
    await db.execute(sql`
      INSERT INTO product_variants (product_id, color_id, stock_total)
      VALUES (${fila.id}, ${colorId}, 5)`);
  }

  return fila.id;
}

let catA: string, catB: string;
let marcaX: string, marcaY: string;
let rojo: string, verde: string;

beforeAll(async () => {
  [catA, catB] = [await unaCategoria("Rubro A"), await unaCategoria("Rubro B")];
  [marcaX, marcaY] = [await unaMarca("Marca X"), await unaMarca("Marca Y")];
  [rojo, verde] = [await unColor("Rojo"), await unColor("Verde")];

  // Precio FINAL: 1000, 4000, 20000 y 50000. El segundo es el que separa
  // «precio» de «precio final»: sale 5000 y se vende a 4000.
  await unProducto({ slug: "uno", marca: marcaX, categoria: catA, precio: "1000.00", colores: [rojo] });
  await unProducto({ slug: "dos", marca: marcaY, categoria: catA, precio: "5000.00", descuento: "1000.00", colores: [verde] });
  await unProducto({ slug: "tres", marca: marcaX, categoria: catB, precio: "20000.00", colores: [rojo, verde] });
  await unProducto({ slug: "cuatro", marca: marcaY, categoria: catB, precio: "50000.00" });
});

afterAll(async () => {
  for (const id of creados.productos) {
    await db.execute(sql`DELETE FROM products WHERE id = ${id}`);
  }
  for (const id of creados.marcas) {
    await db.execute(sql`DELETE FROM brands WHERE id = ${id}`);
  }
  for (const id of creados.categorias) {
    await db.execute(sql`DELETE FROM categories WHERE id = ${id}`);
  }
  for (const id of creados.colores) {
    await db.execute(sql`DELETE FROM colors WHERE id = ${id}`);
  }
});

/** Los slugs cortos que devuelve el catálogo con estos filtros. */
async function buscar(cambio: Partial<FiltrosDeTienda>): Promise<string[]> {
  const filtros: FiltrosDeTienda = {
    ...FILTROS_DE_TIENDA_VACIOS,
    q: T,
    ...cambio,
  };
  const pagina = await leerPaginaDelCatalogo(filtros);
  // El total y la lista tienen que decir lo mismo: son dos consultas
  // distintas con el mismo WHERE, y es exactamente donde se despegan.
  expect(pagina.total).toBe(pagina.productos.length);
  return pagina.productos.map((p) => p.slug.replace(`${T}-`, "")).sort();
}

describe("multiselección", () => {
  test("sin filtros están los cuatro", async () => {
    expect(await buscar({})).toEqual(["cuatro", "dos", "tres", "uno"]);
  });

  test("una marca sola", async () => {
    expect(await buscar({ marca: [marcaX] })).toEqual(["tres", "uno"]);
  });

  test("dentro del grupo las opciones SE SUMAN", async () => {
    expect(await buscar({ marca: [marcaX, marcaY] })).toEqual([
      "cuatro",
      "dos",
      "tres",
      "uno",
    ]);
  });

  test("entre grupos SE CRUZAN", async () => {
    // «(Rubro A) y (Marca Y)» = uno solo. Si se sumaran entre grupos serían
    // tres, y el filtro no filtraría nada.
    expect(await buscar({ categoria: [catA], marca: [marcaY] })).toEqual(["dos"]);
  });

  test("dos categorías y una marca", async () => {
    expect(
      await buscar({ categoria: [catA, catB], marca: [marcaX] }),
    ).toEqual(["tres", "uno"]);
  });

  test("el color mira las variantes, y no repite el producto", async () => {
    // «tres» tiene rojo Y verde: pedir los dos colores tiene que traerlo UNA
    // vez. Con un JOIN en vez del EXISTS saldría dos veces en la grilla y
    // contaría dos en el total.
    expect(await buscar({ color: [rojo, verde] })).toEqual([
      "dos",
      "tres",
      "uno",
    ]);
    expect(await buscar({ color: [verde] })).toEqual(["dos", "tres"]);
  });

  test("un identificador que no existe no rompe: filtra a cero", async () => {
    expect(await buscar({ marca: [randomUUID()] })).toEqual([]);
  });
});

describe("rango de precio", () => {
  test("mira el precio FINAL, no el de lista", async () => {
    // «dos» sale 5000 y se vende a 4000. Con tope en 4500 tiene que entrar.
    expect(await buscar({ precioMax: 4500 })).toEqual(["dos", "uno"]);
  });

  test("los bordes son inclusivos", async () => {
    expect(await buscar({ precioMin: 4000, precioMax: 4000 })).toEqual(["dos"]);
  });

  test("solo mínimo, solo máximo, y los dos", async () => {
    expect(await buscar({ precioMin: 20000 })).toEqual(["cuatro", "tres"]);
    expect(await buscar({ precioMax: 1000 })).toEqual(["uno"]);
    expect(await buscar({ precioMin: 4000, precioMax: 20000 })).toEqual([
      "dos",
      "tres",
    ]);
  });

  test("se combina con los demás filtros", async () => {
    expect(
      await buscar({ marca: [marcaX], precioMin: 5000 }),
    ).toEqual(["tres"]);
  });

  test("un rango sin productos da vacío, no todos", async () => {
    expect(await buscar({ precioMin: 100000 })).toEqual([]);
  });
});

describe("oferta", () => {
  test("solo lo que tiene descuento", async () => {
    expect(await buscar({ oferta: true })).toEqual(["dos"]);
  });
});
