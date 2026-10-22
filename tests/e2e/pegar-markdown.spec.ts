import { expect, test, type Page } from "./apoyo/test";

import { datosDePrueba, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * Pegar Markdown escrito como texto en la descripción — RF-15.
 *
 * La conversión está probada en `tests/unit/content/pegar-markdown.test.ts`;
 * acá se prueba lo que solo existe en el navegador: que el pegado de verdad
 * pase por el plugin, también cuando el portapapeles trae HTML de un editor
 * de código, y que deshacer lo revierta.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
let admin: Cuenta;

test.beforeAll(async () => {
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

/** Un pegado como el del navegador, con lo que traería el portapapeles. */
async function pegar(page: Page, tipos: Record<string, string>) {
  const editor = page.getByRole("textbox", {
    name: "Descripción del producto",
  });
  await editor.click();
  await editor.evaluate((nodo, contenido) => {
    const datos = new DataTransfer();
    for (const [tipo, valor] of Object.entries(contenido)) {
      datos.setData(tipo, valor);
    }
    nodo.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: datos,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, tipos);
  return editor;
}

test.beforeEach(async ({ page }) => {
  await ingresar(page, admin);
  await page.goto("/admin/productos/nuevo");
});

test("negrita y cursiva de un párrafo cortado en renglones", async ({
  page,
}) => {
  const editor = await pegar(page, {
    "text/plain":
      "**Ningún valor secreto va en este documento ni en ningún otro archivo del\n" +
      "repositorio, que es público.** Acá están los _nombres_ de las variables.",
  });

  await expect(editor.locator("strong")).toHaveText(
    "Ningún valor secreto va en este documento ni en ningún otro archivo del " +
      "repositorio, que es público.",
  );
  await expect(editor.locator("em")).toHaveText("nombres");
  await expect(editor).not.toContainText("**");
  await expect(editor.locator("p")).toHaveCount(1);
});

test("los guiones son viñetas, y deshacer lo revierte", async ({ page }) => {
  const editor = await pegar(page, {
    "text/plain": "Incluye:\n- Cable\n- Mouse",
  });

  await expect(editor.locator("ul > li")).toHaveText(["Cable", "Mouse"]);
  await expect(editor.locator("p").first()).toHaveText("Incluye:");

  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor.locator("ul")).toHaveCount(0);
  await expect(editor).not.toContainText("Cable");
});

test("con el HTML coloreado de un editor de código, deciden las marcas", async ({
  page,
}) => {
  const editor = await pegar(page, {
    "text/plain": "Es **liviano**",
    "text/html": '<span style="color:#d4d4d4">Es **liviano**</span>',
  });

  await expect(editor.locator("strong")).toHaveText("liviano");
  await expect(editor).not.toContainText("**");
});

test("sin marcas, cada renglón queda por su lado", async ({ page }) => {
  const editor = await pegar(page, { "text/plain": "Incluye:\nCable\nMouse" });

  await expect(editor).toContainText("Cable");
  await expect(editor.locator("ul")).toHaveCount(0);
  // Lexical pega los renglones como párrafos o con saltos de línea: lo que
  // importa es que no se unieron en uno.
  await expect(editor).not.toContainText("Incluye: Cable");
});
