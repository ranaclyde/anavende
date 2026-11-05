import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * 2026-11-05: en una categoría donde casi todo tiene color, un producto con
 * la variante «Único» muestra un aviso, y al editar esa variante la ayuda
 * explica cuándo usar «Único».
 */

const datos = datosDePrueba();
const palabra = sufijo();
const categoria = `Teclados ${palabra}`;
let admin: Cuenta;
let unico: { id: string };

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(categoria);
  const negro = await datos.unColor(`Negro ${palabra}`, "#111111");
  for (let i = 0; i < 3; i++) {
    await datos.unProducto({
      nombre: `Teclado ${i} ${palabra}`,
      marca,
      marcaId,
      categoriaId,
      precio: "24500.00",
      colores: [negro],
      stock: 2,
    });
  }
  unico = await datos.unProducto({
    nombre: `Teclado único ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "24500.00",
    colores: [],
    stock: 0,
  });
  await datos.unaVarianteUnica(unico.id);
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

test("un «Único» entre productos con color avisa, y la ayuda dice cuándo usarlo", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "anavende:ayudas:v1",
      JSON.stringify(["panel-producto", "ficha"]),
    ),
  );
  await ingresar(page, admin);
  await page.goto(`/admin/productos/${unico.id}`);

  await expect(
    page.getByText(
      `Casi todo en ${categoria} tiene color. Con «Único», este producto no aparece al filtrar por color.`,
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Editar Único" }).click();
  await expect(
    page.getByText(
      "Solo si el color no importa, como en una memoria RAM. Si viene en un solo color, elegí ese color.",
    ),
  ).toBeVisible();
});
