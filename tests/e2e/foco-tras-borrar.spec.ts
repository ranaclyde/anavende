import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F2.15 — Después de borrar una fila, el foco no se cae a `<body>`.
 *
 * El diálogo devuelve el foco al botón que lo abrió (F10.3), pero cuando la
 * lista se refresca ese botón ya no existe. `useFocoQueVuelve` lo ve y lo
 * pasa a la fila siguiente. Se prueba con marcas porque es el borrado más
 * simple; los demás usan el mismo diálogo.
 */

const datos = datosDePrueba();

test.afterAll(async () => {
  await datos.desarmar();
});

test("borrar una marca deja el foco en la fila siguiente", async ({ page }) => {
  const palabra = sufijo();
  // «Aaa» y «Aab»: las dos primeras del listado, una abajo de la otra.
  await datos.unaMarca(`Aaa ${palabra}`);
  await datos.unaMarca(`Aab ${palabra}`);
  const admin = await datos.unaCuenta("Ana", "admin");

  await ingresar(page, admin);
  await page.goto("/admin/catalogo/marcas", { waitUntil: "networkidle" });

  const borrar = page.getByRole("button", {
    name: new RegExp(`^Borrar .*Aaa ${palabra}$`),
  });
  await borrar.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Borrar", exact: true })
    .click();

  await expect(borrar).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: new RegExp(`Aab ${palabra}$`) }).first(),
  ).toBeFocused();
});
