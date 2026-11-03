import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/** El modelo se carga, se busca en el panel y no aparece en la tienda. */

const datos = datosDePrueba();
const palabra = sufijo();
const modelo = `MOD-${palabra}`;
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

test("el modelo se guarda, se busca en el panel y no sale en la tienda", async ({
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
  await expect(page.getByText(modelo)).toBeHidden();
});
