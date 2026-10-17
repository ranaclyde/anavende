import { expect, test } from "@playwright/test";

import {
  datosDePrueba,
  sufijo,
  type Color,
  type ProductoDePrueba,
} from "./apoyo/datos";

/**
 * F10.2 — Buscar, filtrar, abrir la ficha y pedir por WhatsApp. TS §17.2,
 * caso 1; FS RF-01 a RF-04.
 *
 * Es el camino de quien no tiene cuenta, que es el más común: la tienda vende
 * por WhatsApp, y todo lo que hace falta para llegar ahí es encontrar el
 * producto. Por eso el test no entra a ninguna cuenta.
 *
 * Dos productos con la misma palabra en el nombre, para que la búsqueda
 * traiga los dos y **el filtro tenga algo que sacar**: si la búsqueda trajera
 * uno solo, un filtro que no hiciera nada también pasaría. Los dos comparten
 * un color, y el otro color lo tiene uno solo.
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
  // Buscar desde la portada. Tiene su propio buscador, y mientras se ve, el
  // del encabezado no se dibuja (`SearchBox`, prop `principal`).
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

  // Filtrar por el color que tiene uno solo.
  await page.locator("summary", { hasText: "Filtros" }).click();
  await page
    .getByRole("link", { name: `${coral.nombre} 1 — aplicar este filtro` })
    .click();
  await expect(page).toHaveURL(new RegExp(`color=${coral.slug}`));
  // El panel queda abierto al tocar un filtro, a propósito
  // (`filtros-catalogo.tsx`): se cierra con el botón que dice cuántos quedan.
  await page.getByRole("link", { name: "Ver 1 producto" }).click();
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
  // La ficha abre en el primer color, aunque se haya llegado filtrando por
  // otro: la tarjeta no lleva el `?color=`. Se elige, como haría la persona.
  await expect(page.getByRole("radio", { name: grafito.nombre })).toBeChecked();
  // El radio es `sr-only`: lo que se toca es la esfera, que es su `<label>`.
  await page
    .locator("label", {
      has: page.getByRole("radio", { name: coral.nombre }),
    })
    .click();
  await expect(page.getByRole("radio", { name: coral.nombre })).toBeChecked();
  await expect(page).toHaveURL(new RegExp(`color=${coral.slug}`));

  // Dos unidades, y el enlace lleva lo que se está viendo.
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
