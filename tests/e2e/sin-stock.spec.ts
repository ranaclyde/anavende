import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo, type ProductoDePrueba } from "./apoyo/datos";

/**
 * Sin stock, el botón principal dice «Consultar disponibilidad» y no lleva
 * aclaración debajo (pedido del 2026-11-03). El aire hasta «Guardar /
 * Compartir» tiene que ser el mismo que en la ficha con stock.
 */

const datos = datosDePrueba();
const palabra = sufijo();
let agotado: ProductoDePrueba;
let conStock: ProductoDePrueba;

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const base = {
    marca,
    marcaId: await datos.unaMarca(marca),
    categoriaId: await datos.unaCategoria(`Categoria ${palabra}`),
    precio: "24500.00",
    colores: [await datos.unColor(`Gris ${palabra}`, "#888888")],
  };
  agotado = await datos.unProducto({
    ...base,
    nombre: `Agotado ${palabra}`,
    stock: 0,
  });
  conStock = await datos.unProducto({
    ...base,
    nombre: `Con stock ${palabra}`,
    stock: 5,
  });
});

test.afterAll(async () => {
  await datos.desarmar();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("anavende:ayudas:v1", JSON.stringify(["ficha"])),
  );
});

/**
 * Los px entre el borde de abajo del botón y el de arriba de «Compartir»,
 * que va en la misma fila que «Guardar» (sin sesión, «Guardar» es un enlace).
 */
async function aireDebajo(
  page: import("@playwright/test").Page,
  boton: string,
): Promise<number> {
  const abajo = await page
    .getByRole("link", { name: boton })
    .evaluate((n) => n.getBoundingClientRect().bottom);
  const arriba = await page
    .getByRole("button", { name: "Compartir" })
    .evaluate((n) => n.getBoundingClientRect().top);
  return Math.round(arriba - abajo);
}

test("sin stock, el botón dice «Consultar disponibilidad» y va solo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/productos/${conStock.slug}`);
  const conStockAire = await aireDebajo(page, "Comprá ya por WhatsApp");

  await page.goto(`/productos/${agotado.slug}`);
  const boton = page.getByRole("link", { name: "Consultar disponibilidad" });
  await expect(boton).toBeVisible();
  await expect(page.getByText("Preguntá si va a haber")).toHaveCount(0);
  await expect(page.getByText(/avisamos solos/)).toHaveCount(0);

  // El mensaje de WhatsApp no cambió: sigue siendo el de disponibilidad.
  const href = new URL((await boton.getAttribute("href"))!);
  expect(href.searchParams.get("text")).toContain("quería saber si va a haber");

  const sinStockAire = await aireDebajo(page, "Consultar disponibilidad");
  expect(sinStockAire).toBe(conStockAire);

  if (process.env.CAPTURA) {
    await boton.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.CAPTURA}-sin-stock.png` });
    console.log(
      `aire con stock ${conStockAire}px, sin stock ${sinStockAire}px`,
    );
  }
});
