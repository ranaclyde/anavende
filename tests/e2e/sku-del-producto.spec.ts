import { expect, test } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * El SKU (2026-11-05): se carga y se busca en el panel, no se repite dentro
 * de la marca, la ficha lo muestra entre el nombre y el precio con «Copiar»,
 * y la tienda lo encuentra. Un producto de color único lo dice en vez de
 * callarlo.
 */

const datos = datosDePrueba();
const palabra = sufijo();
const sku = `SKU-${palabra}`;
const marca = `Marca ${palabra}`;
let admin: Cuenta;
let producto: { id: string; slug: string };
let gemelo: { id: string };
let deOtraMarca: { slug: string };
let unico: { id: string; slug: string };

test.beforeAll(async () => {
  const marcaId = await datos.unaMarca(marca);
  const otraMarca = `Otra ${palabra}`;
  const otraMarcaId = await datos.unaMarca(otraMarca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  const negro = await datos.unColor(`Negro ${palabra}`, "#111111");
  producto = await datos.unProducto({
    nombre: `Teclado ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "24500.00",
    colores: [negro],
    stock: 5,
  });
  gemelo = await datos.unProducto({
    nombre: `Mouse ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "9000.00",
    colores: [negro],
    stock: 5,
  });
  // El mismo código en otra marca es válido: lo que no se repite es el par.
  // En minúsculas, para que el índice tenga que compararlo sin mayúsculas.
  deOtraMarca = await datos.unProducto({
    nombre: `Auricular ${palabra}`,
    marca: otraMarca,
    marcaId: otraMarcaId,
    categoriaId,
    precio: "15000.00",
    colores: [negro],
    stock: 5,
    sku: sku.toLowerCase(),
  });
  unico = await datos.unProducto({
    nombre: `Memoria ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "18000.00",
    colores: [],
    stock: 0,
  });
  await datos.unaVarianteUnica(unico.id);
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

test("el SKU se guarda, no se repite en la marca y la tienda lo muestra y lo encuentra", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() =>
    localStorage.setItem(
      "anavende:ayudas:v1",
      JSON.stringify(["panel-producto", "ficha"]),
    ),
  );
  await ingresar(page, admin);
  await page.goto(`/admin/productos/${producto.id}`);

  await page.getByRole("textbox", { name: /SKU/ }).fill(sku);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/admin\/productos$/);

  await page.goto(`/admin/productos?q=${sku}`);
  await expect(page.getByText(`Teclado ${palabra}`).first()).toBeVisible();

  // Otro producto de la MISMA marca no puede usar el mismo código, aunque
  // cambien las mayúsculas.
  await page.goto(`/admin/productos/${gemelo.id}`);
  await page.getByRole("textbox", { name: /SKU/ }).fill(sku.toLowerCase());
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByText("Ya hay un producto de esa marca con ese SKU.").first(),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/admin/productos/${gemelo.id}`));

  // La ficha: entre el nombre y el precio, y «Copiar» lo pone en el
  // portapapeles y cambia a «Copiado».
  await page.goto(`/productos/${producto.slug}`);
  const encabezado = page
    .locator("header")
    .filter({ has: page.getByRole("heading", { level: 1 }) })
    .filter({ visible: true });
  await expect(encabezado.getByText(`SKU: ${sku}`)).toBeVisible();
  // El renglón nuevo, por axe: la prueba de accesibilidad usa productos sin
  // SKU y no lo ve.
  expect(await hallazgosDeAxe(page, "header")).toEqual([]);
  await encabezado.getByRole("button", { name: "Copiar SKU" }).click();
  await expect(encabezado.getByText("Copiado", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(sku);
  expect(await hallazgosDeAxe(page, "header")).toEqual([]);

  // La tienda lo encuentra en las dos marcas: el código es el mismo.
  await page.goto(`/productos?q=${sku}`);
  await expect(page.getByRole("status")).toHaveText("2 productos");
  const resultados = page.getByRole("region", { name: "Resultados" });
  await expect(
    resultados.getByRole("heading", { level: 3, name: `Teclado ${palabra}` }),
  ).toBeVisible();

  await page.goto(`/productos/${deOtraMarca.slug}`);
  await expect(
    page.getByText(`SKU: ${sku.toLowerCase()}`).filter({ visible: true }),
  ).toBeVisible();
});

test("sin SKU no hay renglón, y el color único se dice", async ({ page }) => {
  await page.goto(`/productos/${unico.slug}`);
  const encabezado = page
    .locator("header")
    .filter({ has: page.getByRole("heading", { level: 1 }) })
    .filter({ visible: true });
  await expect(encabezado.getByText(marca, { exact: true })).toBeVisible();
  await expect(encabezado.getByText(/SKU/)).toHaveCount(0);
  await expect(
    page.getByText("Color: Único").filter({ visible: true }),
  ).toBeVisible();
});
