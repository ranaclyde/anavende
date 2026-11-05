import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  categoriaQueSeVendePorColor,
  MINIMO_CON_COLOR,
} from "@/modules/catalog/variants/queries";

/**
 * 2026-11-05 — el aviso de «Único» se deduce de lo cargado: avisa si la
 * mayoría de los demás productos activos de la categoría tiene color, y son
 * al menos `MINIMO_CON_COLOR`.
 */

const T = `zzu${randomUUID().slice(0, 8)}`;
const creados = { productos: [] as string[], categorias: [] as string[] };
let marca: string;
let color: string;

beforeAll(async () => {
  const [b] = await db.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug) VALUES (${`Marca ${T}`}, ${`marca-${T}`})
    RETURNING id`);
  marca = b.id;
  const [c] = await db.execute<{ id: string }>(sql`
    INSERT INTO colors (name, slug, hex_code)
    VALUES (${`Negro ${T}`}, ${`negro-${T}`}, '#111111') RETURNING id`);
  color = c.id;
});

afterAll(async () => {
  for (const id of creados.productos) {
    await db.execute(sql`DELETE FROM products WHERE id = ${id}`);
  }
  for (const id of creados.categorias) {
    await db.execute(sql`DELETE FROM categories WHERE id = ${id}`);
  }
  await db.execute(sql`DELETE FROM brands WHERE id = ${marca}`);
  await db.execute(sql`DELETE FROM colors WHERE id = ${color}`);
});

async function unaCategoria(): Promise<string> {
  const n = creados.categorias.length;
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug)
    VALUES (${`Rubro ${n} ${T}`}, ${`rubro-${n}-${T}`}) RETURNING id`);
  creados.categorias.push(fila.id);
  return fila.id;
}

/** Un producto activo con una variante, con color o «Único». */
async function unProducto(categoria: string, conColor: boolean) {
  const n = creados.productos.length;
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
    VALUES (${`P ${n} ${T}`}, ${`p-${n}-${T}`}, ${marca}, ${categoria},
            '1000.00', true)
    RETURNING id`);
  creados.productos.push(fila.id);
  await db.execute(sql`
    INSERT INTO product_variants (product_id, color_id, stock_total)
    VALUES (${fila.id}, ${conColor ? color : null}, 1)`);
  return fila.id;
}

describe("la categoría que se vende por color", () => {
  test("con la mayoría con color, avisa", async () => {
    const cat = await unaCategoria();
    for (let i = 0; i < MINIMO_CON_COLOR; i++) await unProducto(cat, true);
    const unico = await unProducto(cat, false);
    expect(await categoriaQueSeVendePorColor(unico)).toBe(`Rubro 0 ${T}`);
  });

  test("con la mayoría «Único», como unos cables, no", async () => {
    const cat = await unaCategoria();
    for (let i = 0; i < MINIMO_CON_COLOR; i++) await unProducto(cat, true);
    for (let i = 0; i < MINIMO_CON_COLOR + 1; i++) await unProducto(cat, false);
    const unico = await unProducto(cat, false);
    expect(await categoriaQueSeVendePorColor(unico)).toBeNull();
  });

  test("con pocos productos todavía, no: no hay con qué comparar", async () => {
    const cat = await unaCategoria();
    for (let i = 0; i < MINIMO_CON_COLOR - 1; i++) await unProducto(cat, true);
    const unico = await unProducto(cat, false);
    expect(await categoriaQueSeVendePorColor(unico)).toBeNull();
  });

  test("un producto que no existe, tampoco", async () => {
    expect(await categoriaQueSeVendePorColor(randomUUID())).toBeNull();
  });
});
