import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  FILTROS_DE_TIENDA_VACIOS,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import {
  leerOpcionesDeFiltro,
  leerPaginaDelCatalogo,
} from "@/modules/catalog/products/tienda";
import { slugificar } from "@/lib/slug";

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

/**
 * El slug de cada marca, categoría y color creados, por id. Los productos se
 * insertan con ids, pero el filtro de la tienda va por slug desde el
 * 2026-10-14 (`?categoria=teclados`): `buscar` traduce, como lo haría la URL.
 */
const slugDe = new Map<string, string>();
const slug = (nombre: string) => slugificar(`${nombre}-${T}`);

const creados = {
  productos: [] as string[],
  marcas: [] as string[],
  categorias: [] as string[],
  colores: [] as string[],
};

async function unaMarca(nombre: string): Promise<string> {
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug)
    VALUES (${`${nombre} ${T}`}, ${slug(nombre)})
    RETURNING id`);
  creados.marcas.push(fila.id);
  slugDe.set(fila.id, slug(nombre));
  return fila.id;
}

async function unaCategoria(nombre: string): Promise<string> {
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug)
    VALUES (${`${nombre} ${T}`}, ${slug(nombre)})
    RETURNING id`);
  creados.categorias.push(fila.id);
  slugDe.set(fila.id, slug(nombre));
  return fila.id;
}

/** El nombre lleva sufijo: `colors_name_key` es único por `lower(name)`. */
async function unColor(nombre: string): Promise<string> {
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO colors (name, slug, hex_code)
    VALUES (${`${nombre} ${T}`}, ${slug(nombre)}, '#1c1e21')
    RETURNING id`);
  creados.colores.push(fila.id);
  slugDe.set(fila.id, slug(nombre));
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
  await unProducto({
    slug: "uno",
    marca: marcaX,
    categoria: catA,
    precio: "1000.00",
    colores: [rojo],
  });
  await unProducto({
    slug: "dos",
    marca: marcaY,
    categoria: catA,
    precio: "5000.00",
    descuento: "1000.00",
    colores: [verde],
  });
  await unProducto({
    slug: "tres",
    marca: marcaX,
    categoria: catB,
    precio: "20000.00",
    colores: [rojo, verde],
  });
  await unProducto({
    slug: "cuatro",
    marca: marcaY,
    categoria: catB,
    precio: "50000.00",
  });
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
  // Lo que no es un id creado acá pasa tal cual: así se prueba un slug que
  // no existe.
  const aSlugs = (ids: readonly string[] = []) =>
    ids.map((id) => slugDe.get(id) ?? id);
  const filtros: FiltrosDeTienda = {
    ...FILTROS_DE_TIENDA_VACIOS,
    q: T,
    ...cambio,
    categoria: aSlugs(cambio.categoria),
    marca: aSlugs(cambio.marca),
    color: aSlugs(cambio.color),
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
    expect(await buscar({ categoria: [catA], marca: [marcaY] })).toEqual([
      "dos",
    ]);
  });

  test("dos categorías y una marca", async () => {
    expect(await buscar({ categoria: [catA, catB], marca: [marcaX] })).toEqual([
      "tres",
      "uno",
    ]);
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

  test("un slug que no existe no rompe: filtra a cero", async () => {
    expect(await buscar({ marca: [`no-existe-${T}`] })).toEqual([]);
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
    expect(await buscar({ marca: [marcaX], precioMin: 5000 })).toEqual([
      "tres",
    ]);
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

/**
 * Variantes de dos colores (2026-10-05). Va al final y arma su propio
 * producto: agregarlo arriba cambiaría los conteos de todo lo anterior.
 */
describe("una variante de dos colores", () => {
  let azul: string, amarillo: string;

  beforeAll(async () => {
    [azul, amarillo] = [await unColor("Azul"), await unColor("Amarillo")];
    const id = await unProducto({
      slug: "cinco",
      marca: marcaX,
      categoria: catA,
      precio: "3000.00",
    });
    await db.execute(sql`
      INSERT INTO product_variants (product_id, color_id, secondary_color_id, stock_total)
      VALUES (${id}, ${azul}, ${amarillo}, 5)`);
  });

  test("el filtro la encuentra por el primer color", async () => {
    expect(await buscar({ color: [azul] })).toEqual(["cinco"]);
  });

  test("y también por el segundo", async () => {
    expect(await buscar({ color: [amarillo] })).toEqual(["cinco"]);
  });

  test("la tarjeta recibe un solo punto, con las dos tintas y el nombre compuesto", async () => {
    const pagina = await leerPaginaDelCatalogo({
      ...FILTROS_DE_TIENDA_VACIOS,
      q: T,
      color: [slugDe.get(azul)!],
    });
    expect(pagina.productos[0].colores).toEqual([
      { nombre: `Azul ${T}/Amarillo ${T}`, hex: "#1c1e21", hex2: "#1c1e21" },
    ]);
  });
});

/**
 * El drawer de filtros muestra las 8 primeras opciones de cada grupo y
 * esconde el resto detrás de «Ver todas» (2026-11-03), así que el orden decide
 * qué se ve sin abrir nada: las que más productos tienen, primero, y las
 * categorías destacadas antes que todo.
 *
 * Con un token propio y no `T`: estos productos no pueden aparecer en las
 * búsquedas de arriba, que cuentan exactamente cuatro.
 */
describe("el orden de las opciones del filtro", () => {
  const T2 = `zzo${randomUUID().slice(0, 8)}`;
  const de = (nombres: { nombre: string }[]) =>
    nombres
      .filter((o) => o.nombre.endsWith(T2))
      .map((o) => o.nombre.split(" ")[0]);

  beforeAll(async () => {
    const id = async (
      tabla: "brands" | "categories",
      nombre: string,
      destacada = false,
    ) => {
      const [fila] =
        tabla === "brands"
          ? await db.execute<{ id: string }>(sql`
              INSERT INTO brands (name, slug)
              VALUES (${`${nombre} ${T2}`}, ${slugificar(`${nombre}-${T2}`)})
              RETURNING id`)
          : await db.execute<{ id: string }>(sql`
              INSERT INTO categories (name, slug, is_featured)
              VALUES (${`${nombre} ${T2}`}, ${slugificar(`${nombre}-${T2}`)}, ${destacada})
              RETURNING id`);
      (tabla === "brands" ? creados.marcas : creados.categorias).push(fila.id);
      return fila.id;
    };
    const color = async (nombre: string) => {
      const [fila] = await db.execute<{ id: string }>(sql`
        INSERT INTO colors (name, slug, hex_code)
        VALUES (${`${nombre} ${T2}`}, ${slugificar(`${nombre}-${T2}`)}, '#1c1e21')
        RETURNING id`);
      creados.colores.push(fila.id);
      return fila.id;
    };

    // Por nombre irían al revés: el orden tiene que salir de la cantidad.
    const [pocas, muchas] = [
      await id("brands", "Aaa"),
      await id("brands", "Zzz"),
    ];
    const [destacada, comun, llena] = [
      await id("categories", "Zzz", true),
      await id("categories", "Aaa"),
      await id("categories", "Mmm"),
    ];
    const [claro, oscuro] = [await color("Aaa"), await color("Zzz")];

    const productos: [string, string, string][] = [
      [pocas, destacada, claro],
      [muchas, comun, oscuro],
      [muchas, llena, oscuro],
      [muchas, llena, oscuro],
      [muchas, llena, claro],
    ];
    for (const [i, [marca, categoria, colorId]] of productos.entries()) {
      const [fila] = await db.execute<{ id: string }>(sql`
        INSERT INTO products (name, slug, brand_id, category_id, price)
        VALUES (${`${T2} ${i}`}, ${`${T2}-${i}`}, ${marca}, ${categoria}, '1000.00')
        RETURNING id`);
      creados.productos.push(fila.id);
      await db.execute(sql`
        INSERT INTO product_variants (product_id, color_id, stock_total)
        VALUES (${fila.id}, ${colorId}, 5)`);
    }
  });

  test("las marcas y los colores, de más a menos productos", async () => {
    const { marcas, colores } = await leerOpcionesDeFiltro();
    expect(de(marcas)).toEqual(["Zzz", "Aaa"]);
    expect(de(colores)).toEqual(["Zzz", "Aaa"]);
  });

  test("las categorías destacadas primero, aunque tengan menos", async () => {
    const { categorias } = await leerOpcionesDeFiltro();
    expect(de(categorias)).toEqual(["Zzz", "Mmm", "Aaa"]);
  });
});

/**
 * F3.11: la página de una categoría recorta la grilla igual que el filtro, y
 * además recorta lo que ofrece el drawer. Una marca que no tiene nada en la
 * categoría, ofrecida ahí, lleva a un vacío.
 */
describe("la página de una categoría", () => {
  // Una categoría propia: las de arriba ganan productos en otros casos.
  let catC: string;

  beforeAll(async () => {
    catC = await unaCategoria("Rubro C");
    // Precio FINAL 3000 y 8000.
    await unProducto({
      slug: "c-uno",
      marca: marcaX,
      categoria: catC,
      precio: "3000.00",
      colores: [rojo],
    });
    await unProducto({
      slug: "c-dos",
      marca: marcaY,
      categoria: catC,
      precio: "9000.00",
      descuento: "1000.00",
    });
  });

  test("muestra solo su categoría, y se cruza con los filtros", async () => {
    const seccion = slugDe.get(catC)!;
    expect(await buscar({ seccion })).toEqual(["c-dos", "c-uno"]);
    expect(await buscar({ seccion, marca: [marcaX] })).toEqual(["c-uno"]);
  });

  test("«sin filtros» es la categoría entera, no la tienda", async () => {
    const pagina = await leerPaginaDelCatalogo({
      ...FILTROS_DE_TIENDA_VACIOS,
      seccion: slugDe.get(catC)!,
    });
    expect(pagina.totalSinFiltros).toBe(2);
  });

  test("marcas, colores y precio salen de su categoría; las categorías, de todas", async () => {
    const { categorias, marcas, colores, precios } = await leerOpcionesDeFiltro(
      { ...FILTROS_DE_TIENDA_VACIOS, seccion: slugDe.get(catC)! },
    );

    const nuestros = (o: { slug: string }[]) =>
      o.filter((x) => x.slug.endsWith(T)).map((x) => x.slug);
    expect(nuestros(marcas).sort()).toEqual(
      [slugDe.get(marcaX), slugDe.get(marcaY)].sort(),
    );
    // Solo rojo: el verde está en otras categorías, no en esta.
    expect(nuestros(colores)).toEqual([slugDe.get(rojo)]);
    expect(precios).toEqual({ min: 3000, max: 8000 });

    // Todas siguen: en la página se pueden sumar otras.
    expect(nuestros(categorias)).toEqual(
      expect.arrayContaining([
        slugDe.get(catA),
        slugDe.get(catB),
        slugDe.get(catC),
      ]),
    );
  });
});

/**
 * Las opciones se ajustan a lo elegido (2026-11-05): cada grupo se calcula con
 * los filtros de los otros. Acá están los productos de los casos de arriba:
 *
 *   A: uno (X, rojo, 1000) · dos (Y, verde, 4000) · cinco (X, azul/amarillo, 3000)
 *   B: tres (X, rojo y verde, 20000) · cuatro (Y, sin variantes, 50000)
 *   C: c-uno (X, rojo, 3000) · c-dos (Y, sin variantes, 8000)
 *
 * Todo con la búsqueda por el token, para no contar el catálogo sembrado.
 */
describe("las opciones se ajustan a lo elegido", () => {
  // Un id creado acá, o un slug tal cual: el azul y la categoría C se
  // crearon en otros bloques y se nombran por slug.
  const aSlug = (x: string) => slugDe.get(x) ?? x;
  const opciones = (cambio: Partial<FiltrosDeTienda>) =>
    leerOpcionesDeFiltro({
      ...FILTROS_DE_TIENDA_VACIOS,
      q: T,
      ...cambio,
      categoria: (cambio.categoria ?? []).map(aSlug),
      marca: (cambio.marca ?? []).map(aSlug),
      color: (cambio.color ?? []).map(aSlug),
    });
  const slugs = (o: { slug: string }[]) => o.map((x) => x.slug).sort();
  const de = (...ids: string[]) => ids.map(aSlug).sort();
  const cuantos = (o: { slug: string; cuantos: number }[], id: string) =>
    o.find((x) => x.slug === aSlug(id))?.cuantos;

  test("con una categoría, marcas, colores y precio salen de ella", async () => {
    const r = await opciones({ categoria: [catB] });
    expect(slugs(r.marcas)).toEqual(de(marcaX, marcaY));
    expect(slugs(r.colores)).toEqual(de(rojo, verde));
    expect(r.precios).toEqual({ min: 20000, max: 50000 });
  });

  test("el grupo propio no se recorta: las otras categorías se pueden sumar", async () => {
    const r = await opciones({ categoria: [catB] });
    expect(slugs(r.categorias)).toEqual(de(catA, catB, slug("Rubro C")));
  });

  test("con una marca, solo las categorías y colores que tiene", async () => {
    const r = await opciones({ marca: [marcaY] });
    expect(slugs(r.colores)).toEqual(de(verde));
    expect(cuantos(r.categorias, catA)).toBe(1);
  });

  test("con un color, solo las categorías que lo tienen", async () => {
    const r = await opciones({ color: [slug("Azul")] });
    expect(slugs(r.categorias)).toEqual(de(catA));
  });

  test("las ofertas se cuentan con los demás filtros", async () => {
    // Las únicas en oferta son «dos» y «c-dos», las dos de Y.
    expect((await opciones({ marca: [marcaX] })).enOferta).toBe(0);
    expect((await opciones({ marca: [marcaY] })).enOferta).toBe(2);
    expect(
      (await opciones({ marca: [marcaY], categoria: [catA] })).enOferta,
    ).toBe(1);
  });

  test("lo elegido sigue aunque quede en cero, para poder sacarlo", async () => {
    // Ningún producto de Y es rojo.
    const r = await opciones({ marca: [marcaY], color: [rojo] });
    expect(cuantos(r.marcas, marcaY)).toBe(0);
    expect(cuantos(r.colores, rojo)).toBe(0);
    expect(cuantos(r.marcas, marcaX)).toBeGreaterThan(0);
  });
});
