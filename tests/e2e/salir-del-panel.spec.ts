import { expect, test, type Page } from "./apoyo/test";

import { datosDePrueba, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * La administradora cierra sesión desde el panel (2026-10-19).
 *
 * Hasta acá no podía: el pie del menú tenía el modo oscuro, «Ver la tienda» y
 * su nombre, pero no «Cerrar sesión», y el panel no tiene otro lugar desde
 * donde salir. Se prueba en las dos formas del menú —la columna fija de
 * escritorio y el panel deslizable del teléfono—, porque el botón vive en el
 * mismo pie pero se llega distinto.
 *
 * Lo que se mira es que la sesión **se cerró de verdad**: después de salir,
 * volver a `/admin` manda a `/ingresar`.
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
