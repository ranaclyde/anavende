import { expect, test } from "./apoyo/test";
import sharp from "sharp";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Color, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * 2026-11-05: en el panel, las fotos de un color se ven en grande con el
 * mismo visor de la ficha. Se abre tocando la miniatura o desde el menú de
 * cada foto, recorre las de ese color con las flechas y usa la versión
 * `detail`, no la miniatura.
 *
 * Las fotos se borran del storage al terminar (`borrarFotos`).
 */

const datos = datosDePrueba();
const palabra = sufijo();
let admin: Cuenta;
let negro: Color;
let producto: { id: string };

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  negro = await datos.unColor(`Negro ${palabra}`, "#111111");
  producto = await datos.unProducto({
    nombre: `Teclado ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "24500.00",
    colores: [negro],
    stock: 5,
  });
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

/** Un PNG liso de 1600 × 1600: más grande que la pantalla, para el zoom. */
function foto(fondo: string): Promise<Buffer> {
  return sharp({
    create: { width: 1600, height: 1600, channels: 3, background: fondo },
  })
    .png()
    .toBuffer();
}

test("las fotos de un color se ven en grande desde la miniatura y desde el menú", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "anavende:ayudas:v1",
      JSON.stringify(["panel-producto", "ficha"]),
    ),
  );
  await ingresar(page, admin);
  await page.goto(`/admin/productos/${producto.id}`);

  const fila = page
    .getByRole("region", { name: "Colores y stock" })
    .getByRole("listitem")
    .filter({ hasText: `${negro.nombre} ` })
    .first();
  await fila.locator("input[type=file]").setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: await foto("#cc2222") },
    { name: "b.png", mimeType: "image/png", buffer: await foto("#2222cc") },
  ]);
  const opciones = (n: number) =>
    fila.getByRole("button", {
      name: `Opciones de la imagen ${n} de ${negro.nombre}`,
    });
  await expect(opciones(2)).toBeVisible({ timeout: 30_000 });

  // Abrir el menú NO abre el visor: el clic es del menú, no de la foto.
  await opciones(1).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Tocar la miniatura la abre en grande, con la versión `detail`.
  await fila.getByRole("listitem").first().locator("img").click();
  const visor = page.getByRole("dialog", {
    name: `${negro.nombre} — foto 1 de 2`,
  });
  await expect(visor).toBeVisible();
  await expect(visor.locator("img[src*='-detail']")).toHaveCount(1);
  expect(await hallazgosDeAxe(page, '[role="dialog"]')).toEqual([]);

  // Las flechas del teclado recorren las fotos de ese color.
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("dialog", { name: `${negro.nombre} — foto 2 de 2` }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Desde el menú, para quien usa el teclado: abre en la foto elegida.
  await opciones(2).click();
  await page.getByRole("menuitem", { name: "Ver más grande" }).click();
  await expect(
    page.getByRole("dialog", { name: `${negro.nombre} — foto 2 de 2` }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Y el orden sigue cambiándose desde el menú, como antes.
  await opciones(2).click();
  await page.getByRole("menuitem", { name: "Hacer principal" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
