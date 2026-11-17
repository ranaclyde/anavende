import { expect, test, type Page } from "./apoyo/test";

import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * Un despliegue con el panel abierto (2026-11-17).
 *
 * El caso de Sentry: con «Nuevo producto» cargado a medias se desplegó una
 * versión nueva, «Guardar» falló con `UnrecognizedActionError` porque la
 * página tenía los códigos de las Server Actions del build anterior, y
 * «Probar de nuevo» volvió a armar el formulario vacío.
 *
 * El despliegue se simula sin hacer otro build: se intercepta el pedido de
 * la acción y se le cambia el código por uno que no existe. El servidor
 * contesta lo mismo que contestó en producción.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const palabra = sufijo();
const nombre = `Teclado ${palabra}`;
const marca = `Teclas ${palabra}`;
let admin: Cuenta;

test.beforeAll(async () => {
  await datos.unaMarca(marca);
  await datos.unaCategoria(`Teclados ${palabra}`);
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

/** Lo que pasa después de un despliegue: el código de la acción no existe. */
async function simularDespliegue(page: Page, ruta: string) {
  await page.route(`**${ruta}`, async (route) => {
    const pedido = route.request();
    if (pedido.method() !== "POST" || !pedido.headers()["next-action"]) {
      return route.continue();
    }
    await route.continue({
      headers: { ...pedido.headers(), "next-action": "00".repeat(21) },
    });
  });
}

test("lo cargado en un producto sobrevive a la recarga", async ({ page }) => {
  await ingresar(page, admin);
  await page.goto("/admin/productos/nuevo");

  await page.getByRole("textbox", { name: "Nombre" }).fill(nombre);
  const selector = page.getByRole("combobox", { name: "Marca" });
  await selector.click();
  await page.keyboard.type(marca.slice(0, 5));
  await page.getByRole("option", { name: marca }).click();
  await page.getByRole("textbox", { name: "Precio" }).fill("25000");
  const descripcion = page.getByRole("textbox", {
    name: "Descripción del producto",
  });
  await descripcion.click();
  await page.keyboard.type("Mecánico y liviano");

  await simularDespliegue(page, "/admin/productos/nuevo");
  await page.getByRole("button", { name: "Crear producto" }).click();

  // El aviso pide recargar, y el formulario sigue con todo a la vista.
  const aviso = page
    .getByRole("listitem")
    .filter({ hasText: "Se actualizó AnaVende" });
  await expect(aviso).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre" })).toHaveValue(
    nombre,
  );

  // El navegador pregunta si salir con cambios sin guardar: se acepta.
  page.once("dialog", (dialogo) => dialogo.accept());
  await aviso.getByRole("button", { name: "Recargar" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Recuperamos lo que" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre" })).toHaveValue(
    nombre,
  );
  await expect(page.getByRole("textbox", { name: "Precio" })).toHaveValue(
    "25000",
  );
  await expect(selector).toContainText(marca);
  await expect(descripcion).toContainText("Mecánico y liviano");

  // Recargada, la página tiene los códigos nuevos y guardar anda.
  await page.unrouteAll();
  const categoria = page.getByRole("combobox", { name: "Categoría" });
  await categoria.click();
  await page.keyboard.type("Tecla");
  await page.getByRole("option", { name: `Teclados ${palabra}` }).click();
  await page.getByRole("button", { name: "Crear producto" }).click();
  await page.waitForURL(/\/admin\/productos\/[0-9a-f-]{36}\?agregar=color$/);
  datos.anotarProducto(new URL(page.url()).pathname.split("/").pop()!);

  // Guardado, deja de ser un borrador: el próximo alta empieza vacío.
  await page.goto("/admin/productos/nuevo");
  await expect(page.getByRole("textbox", { name: "Nombre" })).toHaveValue("");
  await expect(page.getByText("Recuperamos lo que")).toHaveCount(0);
});

test("la pantalla de error dice que se actualizó y recarga", async ({
  page,
}) => {
  await ingresar(page, admin);
  await page.goto("/admin/legales/garantias");

  const texto = page.getByRole("textbox", { name: /^Texto de/ });
  await texto.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");

  await simularDespliegue(page, "/admin/legales/garantias");
  page.once("dialog", (dialogo) => dialogo.accept());
  await page.getByRole("button", { name: /^Guardar/ }).click();

  await expect(
    page.getByRole("heading", { name: "Se actualizó AnaVende" }),
  ).toBeVisible();
  await expect(page.getByText("Algo falló de nuestro lado")).toHaveCount(0);

  await page.unrouteAll();
  await page.getByRole("button", { name: "Recargar" }).click();
  await expect(texto).toBeVisible();
});
