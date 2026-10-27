import { expect, test, type Locator, type Page } from "./apoyo/test";
import sharp from "sharp";

import { datosDePrueba, sufijo, type Color, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F10.2 — La administradora carga un producto con dos colores y fotos, y
 * aparece publicado. TS §17.2, caso 3; FS RF-14 a RF-16; TS §9.
 *
 * Todo por las pantallas del panel: el alta, los dos colores con su stock y
 * **una foto de verdad en cada uno**, que pasa por sharp y se guarda en el
 * storage del stack local en sus cuatro tamaños. Después, con otro navegador
 * y sin sesión, se busca el producto en la tienda: tiene que aparecer, con
 * los dos colores en la ficha y la foto de cada uno cargando.
 *
 * Las fotos se borran del storage al terminar (`borrarFotos`).
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const palabra = sufijo();
const nombre = `Mouse ${palabra}`;
const marca = `Punteros ${palabra}`;
let admin: Cuenta;
let rojo: Color;
let verde: Color;

test.beforeAll(async () => {
  await datos.unaMarca(marca);
  await datos.unaCategoria(`Mouses ${palabra}`);
  rojo = await datos.unColor(`Rojo ${palabra}`, "#CC2222");
  verde = await datos.unColor(`Verde ${palabra}`, "#22AA44");
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

/** Un PNG liso de 800 × 800: alcanza para que sharp tenga qué achicar. */
function foto(fondo: string): Promise<Buffer> {
  return sharp({
    create: { width: 800, height: 800, channels: 3, background: fondo },
  })
    .png()
    .toBuffer();
}

/**
 * Elige en un selector con buscador (`SelectorConBuscador`) como lo haría
 * alguien: abre, escribe una parte del nombre y toca la opción. La lista va
 * por portal, así que se busca en la página y no dentro del diálogo.
 */
async function elegir(page: Page, selector: Locator, opcion: string) {
  await selector.click();
  await page.keyboard.type(opcion.slice(0, 5));
  await page.getByRole("option", { name: opcion }).click();
  await expect(selector).toContainText(opcion);
}

async function agregarColor(page: Page, color: Color, stock: number) {
  const dialogo = page.getByRole("dialog", { name: "Agregar un color" });
  await elegir(
    page,
    dialogo.getByRole("combobox", { name: "Color", exact: true }),
    color.nombre,
  );
  await dialogo.getByRole("textbox", { name: "Stock" }).fill(String(stock));
  await dialogo.getByRole("button", { name: "Agregar" }).click();
  await expect(dialogo).toBeHidden();
}

async function subirFoto(page: Page, color: Color, fondo: string) {
  const fila = page
    .getByRole("region", { name: "Colores y stock" })
    .getByRole("listitem")
    .filter({ hasText: `${color.nombre} ` })
    .first();
  await fila.locator("input[type=file]").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: await foto(fondo),
  });
  await expect(
    fila.getByRole("button", {
      name: `Opciones de la imagen 1 de ${color.nombre}`,
    }),
  ).toBeVisible({ timeout: 30_000 });
}

test("la administradora carga un producto y aparece publicado", async ({
  page,
  browser,
}) => {
  await ingresar(page, admin);

  // El alta: datos y precio. Los colores se cargan en la pantalla siguiente.
  await page.goto("/admin/productos/nuevo");
  await page.getByRole("textbox", { name: "Nombre" }).fill(nombre);
  await elegir(page, page.getByRole("combobox", { name: "Marca" }), marca);
  await elegir(
    page,
    page.getByRole("combobox", { name: "Categoría" }),
    `Mouses ${palabra}`,
  );
  await page.getByRole("textbox", { name: "Precio" }).fill("15000");
  await page.getByRole("button", { name: "Crear producto" }).click();

  await page.waitForURL(/\/admin\/productos\/[0-9a-f-]{36}\?agregar=color$/);
  const productId = new URL(page.url()).pathname.split("/").pop()!;
  datos.anotarProducto(productId);

  // Dos colores, cada uno con su stock y su foto. El diálogo del primero se
  // abre solo al llegar.
  await agregarColor(page, rojo, 3);
  await subirFoto(page, rojo, "#CC2222");

  await page.getByRole("button", { name: "Agregar color" }).click();
  await agregarColor(page, verde, 2);
  await subirFoto(page, verde, "#22AA44");

  // En la base: activo, dos variantes con su stock y una foto cada una.
  const variantes = await datos.sql<
    { color: string; stock_total: number; fotos: number }[]
  >`
    SELECT c.name AS color, v.stock_total, count(i.id)::int AS fotos
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      JOIN colors c ON c.id = v.color_id
      LEFT JOIN variant_images i ON i.variant_id = v.id
     WHERE p.id = ${productId} AND p.is_active
     GROUP BY c.name, v.stock_total
     ORDER BY c.name`;
  expect(variantes).toEqual([
    { color: rojo.nombre, stock_total: 3, fotos: 1 },
    { color: verde.nombre, stock_total: 2, fotos: 1 },
  ]);

  // En la tienda, desde otro navegador y sin sesión.
  const visitante = await (await browser.newContext()).newPage();
  try {
    await visitante.goto(`/productos?q=${palabra}`);
    const resultados = visitante.getByRole("region", { name: "Resultados" });
    await expect(visitante.getByRole("status")).toHaveText("1 producto");
    await resultados.getByRole("link", { name: nombre, exact: true }).click();

    await expect(
      visitante.getByRole("heading", { level: 1, name: nombre }),
    ).toBeVisible();
    await expect(visitante.getByRole("radio")).toHaveCount(2);

    for (const [color, disponibles] of [
      [rojo, "3 disponibles"],
      [verde, "2 disponibles"],
    ] as const) {
      await visitante
        .locator("label", {
          has: visitante.getByRole("radio", { name: color.nombre }),
        })
        .click();
      await expect(visitante.getByText(disponibles)).toBeVisible();

      // La foto de ese color, y que cargó: un `<img>` con la dirección de
      // un archivo que no está en el storage también tiene `alt`.
      const imagen = visitante
        .getByRole("list", {
          name: `Fotos de ${nombre} ${marca}, ${color.nombre.toLowerCase()}`,
        })
        .getByRole("img")
        .first();
      await expect(imagen).toBeVisible();
      await expect
        .poll(() =>
          imagen.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth,
          ),
        )
        .toBeGreaterThan(0);
    }
  } finally {
    await visitante.context().close();
  }
});
