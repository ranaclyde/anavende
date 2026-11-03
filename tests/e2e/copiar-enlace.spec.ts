import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/** El enlace de un producto activo se copia desde el panel; el inactivo no lo ofrece. */

const datos = datosDePrueba();
const palabra = sufijo();
let admin: Cuenta;
let producto: { id: string; slug: string };

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
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
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

test("copia el enlace del producto activo y lo oculta si está inactivo", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() =>
    localStorage.setItem(
      "anavende:ayudas:v1",
      JSON.stringify(["panel-producto"]),
    ),
  );
  await ingresar(page, admin);
  await page.goto(`/admin/productos/${producto.id}`);

  await page.getByRole("button", { name: "Copiar enlace" }).click();
  await expect(page.getByText("Copiaste el enlace")).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado.endsWith(`/productos/${producto.slug}`)).toBe(true);
  if (process.env.CAPTURA) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: process.env.CAPTURA });
  }

  await page.getByRole("checkbox", { name: /Activo en la tienda/ }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/admin\/productos$/);

  await page.goto(`/admin/productos/${producto.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copiar enlace" }),
  ).toBeHidden();
});
