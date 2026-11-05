import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * El modelo se carga y se busca en el panel, y la ficha lo muestra junto a la
 * marca (2026-11-05). Un producto de color único lo dice en vez de callarlo.
 */

const datos = datosDePrueba();
const palabra = sufijo();
const modelo = `MOD-${palabra}`;
const marca = `Marca ${palabra}`;
let admin: Cuenta;
let producto: { id: string; slug: string };
let unico: { id: string; slug: string };

test.beforeAll(async () => {
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  producto = await datos.unProducto({
    nombre: `Teclado ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "24500.00",
    colores: [await datos.unColor(`Negro ${palabra}`, "#111111")],
    stock: 5,
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

test("el modelo se guarda, se busca en el panel y sale en la ficha", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "anavende:ayudas:v1",
      JSON.stringify(["panel-producto", "ficha"]),
    ),
  );
  await ingresar(page, admin);
  await page.goto(`/admin/productos/${producto.id}`);

  await page.getByRole("textbox", { name: /Modelo/ }).fill(modelo);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/admin\/productos$/);

  await page.goto(`/admin/productos?q=${modelo}`);
  await expect(page.getByText(`Teclado ${palabra}`).first()).toBeVisible();

  await page.goto(`/admin/productos/${producto.id}`);
  await expect(page.getByRole("textbox", { name: /Modelo/ })).toHaveValue(
    modelo,
  );

  await page.goto(`/productos/${producto.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // La tienda lo encuentra por el modelo, aunque no esté en el nombre.
  await page.goto(`/productos?q=${modelo}`);
  await expect(page.getByRole("status")).toHaveText("1 producto");
  await expect(
    page
      .getByRole("region", { name: "Resultados" })
      .getByRole("heading", { level: 3, name: `Teclado ${palabra}` }),
  ).toBeVisible();

  await page.goto(`/productos/${producto.slug}`);
  await expect(
    page.getByText(`${marca} · ${modelo}`).filter({ visible: true }),
  ).toBeVisible();
});

test("sin modelo queda solo la marca, y el color único se dice", async ({
  page,
}) => {
  await page.goto(`/productos/${unico.slug}`);
  // El encabezado de la ficha: los recomendados también muestran la marca.
  const encabezado = page
    .locator("header")
    .filter({ has: page.getByRole("heading", { level: 1 }) })
    .filter({ visible: true });
  await expect(encabezado.getByText(marca, { exact: true })).toBeVisible();
  await expect(encabezado.getByText(/·/)).toHaveCount(0);
  await expect(
    page.getByText("Color: Único").filter({ visible: true }),
  ).toBeVisible();
});
