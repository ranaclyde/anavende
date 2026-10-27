import { expect, test, type Locator, type Page } from "./apoyo/test";

import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F2.13 — Crear una marca, una categoría o un color sin salir del producto.
 *
 * Con el catálogo sin nada que sirva, el alta se completa igual: cada
 * selector ofrece crear lo que se escribió, el drawer del catálogo abre con
 * el nombre puesto y, al guardar, queda elegido. Lo que ya estaba cargado en
 * el producto —el nombre, el stock de la variante— sigue ahí al volver.
 */

const datos = datosDePrueba();
const palabra = sufijo();
const nombre = `Parlante ${palabra}`;
const marca = `Sonoros ${palabra}`;
const categoria = `Parlantes ${palabra}`;
const color = `Celeste ${palabra}`;
let admin: Cuenta;

test.beforeAll(async () => {
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  // Lo creó la pantalla, así que hay que buscarlo para poder borrarlo.
  for (const [lista, tabla, valor] of [
    ["marcas", "brands", marca],
    ["categorias", "categories", categoria],
    ["colores", "colors", color],
  ] as const) {
    const filas = await datos.sql<{ id: string }[]>`
      SELECT id FROM ${datos.sql(tabla)} WHERE name = ${valor}`;
    for (const f of filas) datos.anotarDelCatalogo(lista, f.id);
  }
  await datos.desarmar();
});

/** Abre el selector, escribe un nombre que no está y toca «Crear…». */
async function crearDesde(
  page: Page,
  selector: Locator,
  escrito: string,
  renglon: string,
) {
  await selector.click();
  await page.keyboard.type(escrito);
  await page.getByRole("option", { name: renglon }).click();
}

test("se crea marca, categoría y color sin salir del producto", async ({
  page,
}) => {
  await ingresar(page, admin);
  await page.goto("/admin/productos/nuevo");
  await page.getByRole("textbox", { name: "Nombre" }).fill(nombre);

  // La marca: el drawer del catálogo, con lo escrito ya puesto.
  const selectorDeMarca = page.getByRole("combobox", { name: "Marca" });
  await crearDesde(page, selectorDeMarca, marca, `Crear la marca «${marca}»`);
  const nuevaMarca = page.getByRole("dialog", { name: "Nueva marca" });
  await expect(nuevaMarca.getByRole("textbox", { name: "Nombre" })).toHaveValue(
    marca,
  );
  await nuevaMarca.getByRole("button", { name: "Crear" }).click();
  await expect(nuevaMarca).toBeHidden();
  await expect(selectorDeMarca).toContainText(marca);

  // La categoría, igual.
  const selectorDeCategoria = page.getByRole("combobox", { name: "Categoría" });
  await crearDesde(
    page,
    selectorDeCategoria,
    categoria,
    `Crear la categoría «${categoria}»`,
  );
  const nuevaCategoria = page.getByRole("dialog", { name: "Nueva categoría" });
  await nuevaCategoria.getByRole("button", { name: "Crear" }).click();
  await expect(nuevaCategoria).toBeHidden();
  await expect(selectorDeCategoria).toContainText(categoria);

  // Lo que se había escrito antes de ir y volver sigue ahí.
  await expect(page.getByRole("textbox", { name: "Nombre" })).toHaveValue(
    nombre,
  );

  await page.getByRole("textbox", { name: "Precio" }).fill("42000");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await page.waitForURL(/\/admin\/productos\/[0-9a-f-]{36}\?agregar=color$/);
  datos.anotarProducto(new URL(page.url()).pathname.split("/").pop()!);

  // El color es un paso adentro del drawer de la variante.
  const drawer = page.getByRole("dialog", { name: "Agregar un color" });
  await drawer.getByRole("textbox", { name: "Stock" }).fill("4");
  const selectorDeColor = drawer.getByRole("combobox", {
    name: "Color",
    exact: true,
  });

  // Escape en el paso de crear vuelve a la variante, no cierra todo.
  await crearDesde(page, selectorDeColor, color, `Crear el color «${color}»`);
  const paso = page.getByRole("dialog", { name: "Nuevo color" });
  await expect(paso).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("textbox", { name: "Stock" })).toHaveValue("4");
  await expect(selectorDeColor).toBeFocused();

  await crearDesde(page, selectorDeColor, color, `Crear el color «${color}»`);
  await expect(paso.getByRole("textbox", { name: "Nombre" })).toHaveValue(
    color,
  );
  await paso
    .getByRole("textbox", { name: "Color", exact: true })
    .fill("#3399FF");
  await paso.getByRole("button", { name: "Crear" }).click();

  await expect(drawer).toBeVisible();
  await expect(selectorDeColor).toContainText(color);
  await expect(drawer.getByRole("textbox", { name: "Stock" })).toHaveValue("4");
  await drawer.getByRole("button", { name: "Agregar" }).click();
  await expect(drawer).toBeHidden();

  // En la base: el producto con su marca, su categoría y su color nuevos.
  const [fila] = await datos.sql<
    {
      marca: string;
      categoria: string;
      color: string;
      hex: string;
      stock: number;
    }[]
  >`
    SELECT b.name AS marca, c.name AS categoria, co.name AS color,
           lower(co.hex_code) AS hex, v.stock_total AS stock
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      JOIN categories c ON c.id = p.category_id
      JOIN product_variants v ON v.product_id = p.id
      JOIN colors co ON co.id = v.color_id
     WHERE p.name = ${nombre}`;
  expect(fila).toEqual({
    marca,
    categoria,
    color,
    hex: "#3399ff",
    stock: 4,
  });
});
