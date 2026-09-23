import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";

import { db } from "@/db";
import { productosDelMapa } from "@/modules/catalog/products/mapa-del-sitio";

/**
 * F3.9 — el mapa del sitio, contra Postgres de verdad.
 *
 * Lo que hay que verificar es SQL, y es silencioso: un `WHERE is_active` que
 * falte no rompe nada: publica en el mapa del sitio direcciones que devuelven
 * 404, y eso se entera Google antes que nadie.
 *
 * **Acotado a lo que crea este archivo.** La base de desarrollo tiene el
 * catálogo sembrado, así que contar filas sin acotar daría un número que
 * depende de cuándo se corrió el seed.
 */

const T = `zzmapa${randomUUID().slice(0, 8)}`;
const creados = {
  productos: [] as string[],
  marcas: [] as string[],
  categorias: [] as string[],
};

async function unProducto(nombre: string, activo: boolean): Promise<string> {
  const [marca] = await db.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug)
    VALUES (${`Marca ${nombre} ${T}`}, ${`marca-${nombre}-${T}`})
    RETURNING id`);
  creados.marcas.push(marca.id);

  const [categoria] = await db.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug)
    VALUES (${`Cat ${nombre} ${T}`}, ${`cat-${nombre}-${T}`})
    RETURNING id`);
  creados.categorias.push(categoria.id);

  const [producto] = await db.execute<{ id: string }>(sql`
    INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
    VALUES (${`Producto ${nombre}`}, ${`${nombre}-${T}`}, ${marca.id},
            ${categoria.id}, '1000.00', ${activo})
    RETURNING id`);
  creados.productos.push(producto.id);

  return producto.id;
}

beforeAll(async () => {
  await unProducto("activo", true);
  await unProducto("inactivo", false);
});

afterAll(async () => {
  // De a uno y en este orden: los productos referencian marca y categoría con
  // RESTRICT, así que primero se van ellos.
  for (const id of creados.productos) {
    await db.execute(sql`DELETE FROM products WHERE id = ${id}`);
  }
  for (const id of creados.marcas) {
    await db.execute(sql`DELETE FROM brands WHERE id = ${id}`);
  }
  for (const id of creados.categorias) {
    await db.execute(sql`DELETE FROM categories WHERE id = ${id}`);
  }
});

test("el activo entra al mapa y el desactivado no", async () => {
  const slugs = (await productosDelMapa())
    .map((p) => p.slug)
    .filter((s) => s.endsWith(T));

  // RN-05: la ficha de un producto desactivado devuelve 404. Ofrecerla en el
  // mapa del sitio es pedirle a Google que registre un error nuestro.
  expect(slugs).toEqual([`activo-${T}`]);
});

test("la fecha sale en el formato que pide `lastmod`, no como la escribe Postgres", async () => {
  const fila = (await productosDelMapa()).find((p) => p.slug === `activo-${T}`);

  // Éste es el test que importa de todo el archivo. Postgres devuelve
  // `2026-09-22 23:16:33.078552+00` —con un espacio en el medio y sin `T`— y
  // Next escribe en el mapa lo que reciba: un `<lastmod>` así lo descartan
  // todos los buscadores, y nadie avisa.
  expect(fila?.actualizado).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

  // Y es la fecha de verdad, no una cadena cualquiera con la forma correcta.
  expect(Date.now() - Date.parse(fila?.actualizado ?? "")).toBeLessThan(60_000);
});

test("lo más nuevo va primero: es de donde sale el `lastmod` de la home", async () => {
  const fechas = (await productosDelMapa()).map((p) =>
    Date.parse(p.actualizado),
  );
  expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
});
