import { expect, test, type Page } from "./apoyo/test";

import { datosDePrueba, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * Cerrar sesión desde el pie del menú del panel, en sus dos formas
 * (escritorio y teléfono): el botón es el mismo pero se llega distinto. Se
 * mira que la sesión **se cerró de verdad**.
 */

const datos = datosDePrueba();
let admin: Cuenta;

test.beforeAll(async () => {
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

async function quedoAfuera(page: Page) {
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/ingresar/);
}

test("sale desde el menú de escritorio", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ingresar(page, admin);
  await page.goto("/admin");

  await page
    .getByRole("complementary", { name: "Secciones del panel" })
    .getByRole("button", { name: "Cerrar sesión" })
    .click();

  await quedoAfuera(page);
});

test("sale desde el menú del teléfono", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ingresar(page, admin);
  await page.goto("/admin");

  await page.getByRole("button", { name: "Abrir el menú" }).click();
  await page
    .getByRole("complementary", { name: "Secciones del panel" })
    .getByRole("button", { name: "Cerrar sesión" })
    .click();

  await quedoAfuera(page);
});
