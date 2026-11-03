import { expect, test } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import {
  datosDePrueba,
  sufijo,
  type Cuenta,
  type ProductoDePrueba,
} from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * Con más de tres colores, cada uno se pliega y se abre de a uno; con tres o
 * menos se ven enteros (pedido del 2026-11-03).
 */

const datos = datosDePrueba();
const palabra = sufijo();
let admin: Cuenta;
let cinco: ProductoDePrueba;
let tres: ProductoDePrueba;
let gris: string;

const NOMBRES = ["Negro", "Blanco", "Rojo", "Azul", "Verde"];
const HEX = ["#111111", "#f5f5f5", "#c0392b", "#2c6fbb", "#2e8b57"];

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  const colores = [];
  for (const [i, nombre] of NOMBRES.entries()) {
    colores.push(await datos.unColor(`${nombre} ${palabra}`, HEX[i]));
  }
  const base = { marca, marcaId, categoriaId, precio: "24500.00", stock: 5 };
  cinco = await datos.unProducto({
    ...base,
    nombre: `Joystick ${palabra}`,
    colores,
  });
  tres = await datos.unProducto({
    ...base,
    nombre: `Mouse ${palabra}`,
    colores: colores.slice(0, 3),
  });
  // Un sexto color que el producto todavía no tiene, para agregarlo.
  gris = (await datos.unColor(`Gris ${palabra}`, "#888888")).nombre;
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "anavende:ayudas:v1",
      JSON.stringify(["panel-producto"]),
    ),
  );
  await ingresar(page, admin);
});

const color = (i: number) => `${NOMBRES[i]} ${palabra}`;

test("con cinco colores se abre uno por vez, y arranca el primero", async ({
  page,
}) => {
  await page.goto(`/admin/productos/${cinco.id}`);
  const disparador = (i: number) =>
    page.getByRole("button", { name: new RegExp(`^${color(i)}`) });

  await expect(disparador(0)).toHaveAttribute("aria-expanded", "true");
  for (const i of [1, 2, 3, 4]) {
    await expect(disparador(i)).toHaveAttribute("aria-expanded", "false");
  }
  // Abierto: editar y sacar. Cerrado: ni los botones ni las fotos.
  await expect(
    page.getByRole("button", { name: `Editar ${color(0)}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Editar ${color(1)}` }),
  ).toHaveCount(0);
  await expect(
    page.locator(`#color-${cinco.variantes[1].id} [data-agregar-fotos]`),
  ).toBeHidden();
  // El stock se ve igual con el color cerrado.
  await expect(
    page.locator(`#color-${cinco.variantes[1].id}`).getByText("5 disponibles"),
  ).toBeVisible();

  if (process.env.CAPTURA) {
    await page.locator("#colores-y-stock").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${process.env.CAPTURA}-cinco.png`,
      fullPage: true,
    });
  }

  await disparador(2).click();
  await expect(disparador(2)).toHaveAttribute("aria-expanded", "true");
  await expect(disparador(0)).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: `Sacar ${color(2)}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Editar ${color(0)}` }),
  ).toHaveCount(0);

  // Tocar el abierto lo cierra: quedan todos cerrados.
  await disparador(2).click();
  await expect(disparador(2)).toHaveAttribute("aria-expanded", "false");

  // Con el teclado: flecha abajo pasa al siguiente, Enter lo abre.
  await disparador(2).focus();
  await page.keyboard.press("ArrowDown");
  await expect(disparador(3)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(disparador(3)).toHaveAttribute("aria-expanded", "true");

  expect(await hallazgosDeAxe(page, "#colores-y-stock")).toEqual([]);
});

test("con tres colores se ven enteros, sin plegar", async ({ page }) => {
  await page.goto(`/admin/productos/${tres.id}`);
  for (const i of [0, 1, 2]) {
    await expect(
      page.getByRole("button", { name: `Editar ${color(i)}` }),
    ).toBeVisible();
  }
  await expect(page.locator("#colores-y-stock [aria-expanded]")).toHaveCount(0);

  if (process.env.CAPTURA) {
    await page.locator("#colores-y-stock").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${process.env.CAPTURA}-tres.png`,
      fullPage: true,
    });
  }
});

test("plegados, en el teléfono y en oscuro, pasan axe y no ensanchan la página", async ({
  page,
}) => {
  // La ficha que revisa `accesibilidad.spec.ts` tiene pocos colores y nunca
  // los pliega: se revisa acá, en el ancho y el tema donde más se rompe.
  await page.addInitScript(() =>
    localStorage.setItem("anavende:admin-theme", "dark"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/productos/${cinco.id}`);
  await expect(
    page.getByRole("button", { name: new RegExp(`^${color(1)}`) }),
  ).toHaveAttribute("aria-expanded", "false");

  expect(await hallazgosDeAxe(page, "#colores-y-stock")).toEqual([]);
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);

  if (process.env.CAPTURA) {
    await page
      .getByRole("button", { name: new RegExp(`^${color(1)}`) })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.CAPTURA}-telefono.png` });
  }
});

test("agregar un color lo abre y deja el foco en sus fotos", async ({
  page,
}) => {
  await page.goto(`/admin/productos/${cinco.id}`);
  await page.getByRole("button", { name: "Agregar color" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("combobox", { name: "Color" }).click();
  await page.getByRole("option", { name: gris }).click();
  await drawer.getByLabel("Stock").fill("3");
  await drawer.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(drawer).toBeHidden();

  const nuevo = page.getByRole("button", { name: new RegExp(`^${gris}`) });
  await expect(nuevo).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: new RegExp(`^${color(0)}`) }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.locator("li", { has: nuevo }).locator("[data-agregar-fotos]"),
  ).toBeFocused();
});
