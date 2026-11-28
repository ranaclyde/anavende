import { expect, test } from "./apoyo/test";

import {
  datosDePrueba,
  sufijo,
  type Color,
  type ProductoDePrueba,
} from "./apoyo/datos";

/**
 * Buscar, filtrar, abrir la ficha y pedir por WhatsApp, sin cuenta (TS
 * §17.2, caso 1). Dos productos con la misma palabra para que **el filtro
 * tenga algo que sacar**: con uno solo, un filtro que no hiciera nada también
 * pasaría.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const palabra = sufijo();
let parlante: ProductoDePrueba;
let auricular: ProductoDePrueba;
let grafito: Color;
let coral: Color;

test.beforeAll(async () => {
  const marca = `Sonora ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Audio ${palabra}`);
  grafito = await datos.unColor(`Grafito ${palabra}`, "#3A3A3A");
  coral = await datos.unColor(`Coral ${palabra}`, "#FF7F50");

  parlante = await datos.unProducto({
    nombre: `Parlante ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "24500.00",
    colores: [grafito, coral],
    stock: 5,
  });
  auricular = await datos.unProducto({
    nombre: `Auricular ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "18000.00",
    colores: [grafito],
    stock: 5,
  });
});

test.afterAll(async () => {
  await datos.desarmar();
});

test("visitante busca, filtra, abre la ficha y arma el WhatsApp", async ({
  page,
}) => {
  // Mientras se ve el buscador de la portada, el del encabezado no se dibuja.
  await page.goto("/");
  await page
    .getByRole("main")
    .getByRole("searchbox", { name: "Buscar productos" })
    .fill(palabra);
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `Resultados para «${palabra}»`,
    }),
  ).toBeVisible();
  const resultados = page.getByRole("region", { name: "Resultados" });
  await expect(page.getByRole("status")).toHaveText("2 productos");
  // El orden es el de «Destacados», que no es lo que se prueba acá.
  await expect(resultados.getByRole("heading", { level: 3 })).toHaveCount(2);
  expect(
    (await resultados.getByRole("heading", { level: 3 }).allTextContents())
      .map((t) => t.trim())
      .sort(),
  ).toEqual([auricular.nombre, parlante.nombre].sort());

  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page
    .getByRole("link", { name: `${coral.nombre} — aplicar este filtro` })
    .click();
  await expect(page).toHaveURL(new RegExp(`color=${coral.slug}`));
  // El drawer queda abierto al tocar un filtro, a propósito.
  await page.getByRole("button", { name: "Ver 1 producto" }).click();
  await expect(page.getByRole("status")).toHaveText("1 producto");
  await expect(resultados.getByRole("heading", { level: 3 })).toHaveText([
    parlante.nombre,
  ]);

  await resultados
    .getByRole("link", { name: parlante.nombre, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/productos/${parlante.slug}`));
  await expect(
    page.getByRole("heading", { level: 1, name: parlante.nombre }),
  ).toBeVisible();
  // La tarjeta no lleva el `?color=`: la ficha abre en el primer color.
  await expect(page.getByRole("radio", { name: grafito.nombre })).toBeChecked();
  // El radio es `sr-only`: lo que se toca es la esfera, que es su `<label>`.
  await page
    .locator("label", {
      has: page.getByRole("radio", { name: coral.nombre }),
    })
    .click();
  await expect(page.getByRole("radio", { name: coral.nombre })).toBeChecked();
  await expect(page).toHaveURL(new RegExp(`color=${coral.slug}`));

  await page.getByRole("button", { name: "Agregar uno" }).click();
  await expect(page.getByRole("spinbutton", { name: "Cantidad" })).toHaveValue(
    "2",
  );

  const whatsapp = page.getByRole("link", { name: "Comprá ya por WhatsApp" });
  const enlace = new URL((await whatsapp.getAttribute("href"))!);

  expect(enlace.origin + enlace.pathname).toBe(
    `https://wa.me/${await datos.numeroDeWhatsApp()}`,
  );
  const mensaje = enlace.searchParams.get("text")!;
  expect(mensaje).toContain(`${parlante.nombre} (${parlante.marca})`);
  expect(mensaje).toContain(`Color: ${coral.nombre.toLowerCase()}`);
  expect(mensaje).toContain("Cantidad: 2");
  expect(mensaje).toContain("Precio por unidad: $ 24.500,00");
  expect(mensaje).toContain(`/productos/${parlante.slug}?color=${coral.slug}`);
});
