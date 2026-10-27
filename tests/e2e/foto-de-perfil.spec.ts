import postgres from "postgres";
import sharp from "sharp";

import { expect, test, type Browser, type Page } from "./apoyo/test";

import { datosDePrueba, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F5.9 — La foto de perfil, de punta a punta.
 *
 * La compradora arranca con su blobatar, sube una foto desde «Mis datos», la
 * ve en el encabezado de la tienda, la administradora la ve en el listado y
 * en la ficha, y al quitarla la cuenta vuelve al blobatar y Storage se queda
 * sin el archivo.
 *
 * Lo que distingue una cosa de la otra es el `src`: el blobatar es un `data:`
 * que arma el servidor, y la foto es un archivo bajo `usuarios/{id}/`.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let admin: Cuenta;
let compradora: Cuenta;

test.beforeAll(async () => {
  admin = await datos.unaCuenta("Ana", "admin");
  compradora = await datos.unaCuenta("Compradora");
});

test.afterAll(async () => {
  await datos.desarmar();
  await sql.end();
});

/** Una «foto de celular»: vertical, más grande que 256 y con algo adentro. */
async function unaFoto(): Promise<Buffer> {
  return sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: { r: 210, g: 160, b: 120 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="900" height="1200"><circle cx="450" cy="420" r="220" fill="#5a3b2a"/></svg>',
        ),
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * La cara del encabezado: el `img` dentro del enlace a la cuenta. **La que se
 * ve**: mientras llega el HTML en streaming, el encabezado está dos veces en
 * el DOM —el de Suspense y uno escondido que React después pone en su
 * lugar—, y con el refresco de después de subir pasa lo mismo.
 */
function caraDelEncabezado(page: Page) {
  return page
    .locator('header a[href="/mi-cuenta"] img')
    .filter({ visible: true });
}

/**
 * El blobatar del encabezado: SVG en la página y no `<img>` —`.mo-root` es su grupo de adentro—, porque se mueve
 * al pasar el mouse (`CaraAnimada`).
 */
function blobatarDelEncabezado(page: Page) {
  return page
    .locator('header a[href="/mi-cuenta"] svg .mo-root')
    .filter({ visible: true });
}

async function claveGuardada(): Promise<string | null> {
  const [fila] = await sql<{ avatar_key: string | null }[]>`
    SELECT avatar_key FROM user_profiles WHERE id = ${compradora.id}`;
  return fila.avatar_key;
}

async function otroNavegador(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test("sin foto, la cuenta se ve con su blobatar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ingresar(page, compradora);
  await page.goto("/mi-cuenta");

  await expect(blobatarDelEncabezado(page)).toBeVisible();
  await expect(caraDelEncabezado(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Subir una foto" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Quitar foto" })).toHaveCount(
    0,
  );
});

/**
 * Se mueve al pasar el mouse por la píldora de la cuenta, no solo por el
 * dibujo, y quieto con «reducir movimiento». Lo que se mira es el `transform`
 * del SVG: en reposo no tiene, y al moverse sube y crece.
 */
test("el blobatar se mueve al pasar el mouse, y no con «reducir movimiento»", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ingresar(page, compradora);
  await page.goto("/mi-cuenta");

  const bicho = blobatarDelEncabezado(page);
  const transformacion = () =>
    bicho.evaluate((el) => getComputedStyle(el).transform);
  expect(await transformacion()).toBe("none");

  // Sobre el nombre, a la derecha del dibujo: es la píldora la que lo mueve.
  await page
    .locator('header a[href="/mi-cuenta"]')
    .filter({ visible: true })
    .hover({ position: { x: 90, y: 22 } });
  await expect.poll(transformacion).not.toBe("none");

  await page.mouse.move(5, 500);
  await expect.poll(transformacion).toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .locator('header a[href="/mi-cuenta"]')
    .filter({ visible: true })
    .hover({ position: { x: 90, y: 22 } });
  await page.waitForTimeout(400);
  expect(await transformacion()).toBe("none");
});

test("sube una foto y se ve en la tienda y en el panel", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ingresar(page, compradora);
  await page.goto("/mi-cuenta");

  const elegir = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Subir una foto" }).click();
  await (
    await elegir
  ).setFiles({
    name: "yo.jpg",
    mimeType: "image/jpeg",
    buffer: await unaFoto(),
  });

  await expect(page.getByRole("status")).toHaveText(
    "Listo, cambiamos tu foto.",
  );
  await expect(caraDelEncabezado(page)).toHaveAttribute(
    "src",
    new RegExp(`/usuarios/${compradora.id}/[^/]+-avatar\\.webp$`),
  );
  await expect(
    page.getByRole("button", { name: "Cambiar foto" }),
  ).toBeVisible();

  // Una sola versión, cuadrada, de 256px.
  const clave = await claveGuardada();
  expect(clave).toMatch(new RegExp(`^usuarios/${compradora.id}/`));
  const src = await caraDelEncabezado(page).getAttribute("src");
  const archivo = await (await fetch(src!)).arrayBuffer();
  const meta = await sharp(Buffer.from(archivo)).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);

  // La administradora la ve en el listado y en la ficha.
  const ana = await otroNavegador(browser);
  await ingresar(ana, admin);
  await ana.goto(`/admin/usuarios?q=${encodeURIComponent(compradora.email)}`);
  await expect(
    ana.locator(`tr:has(a[href="/admin/usuarios/${compradora.id}"]) img`),
  ).toHaveAttribute("src", src!);

  // En la ficha, tocarla la abre ampliada en un diálogo, sin salir de ahí.
  await ana.goto(`/admin/usuarios/${compradora.id}`);
  await ana.getByRole("button", { name: /Ver la foto de Compradora/ }).click();
  const dialogo = ana.getByRole("dialog", { name: /Foto de Compradora/ });
  await expect(dialogo.getByRole("img")).toHaveAttribute("src", src!);
  expect(new URL(ana.url()).pathname).toBe(`/admin/usuarios/${compradora.id}`);
  await ana.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await ana.context().close();
});

test("cambiarla borra la anterior", async ({ page }) => {
  await ingresar(page, compradora);
  await page.goto("/mi-cuenta");
  const anterior = await caraDelEncabezado(page).getAttribute("src");

  const elegir = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Cambiar foto" }).click();
  await (
    await elegir
  ).setFiles({
    name: "otra.jpg",
    mimeType: "image/jpeg",
    buffer: await unaFoto(),
  });

  await expect(page.getByRole("status")).toHaveText(
    "Listo, cambiamos tu foto.",
  );
  await expect(caraDelEncabezado(page)).not.toHaveAttribute("src", anterior!);
  expect((await fetch(anterior!)).status).toBeGreaterThanOrEqual(400);
});

test("quitarla vuelve al blobatar y borra el archivo", async ({ page }) => {
  await ingresar(page, compradora);
  await page.goto("/mi-cuenta");
  const foto = await caraDelEncabezado(page).getAttribute("src");

  await page.getByRole("button", { name: "Quitar foto" }).click();

  await expect(page.getByRole("status")).toHaveText("Listo, quitamos tu foto.");
  await expect(blobatarDelEncabezado(page)).toBeVisible();
  await expect(caraDelEncabezado(page)).toHaveCount(0);
  expect(await claveGuardada()).toBeNull();
  expect((await fetch(foto!)).status).toBeGreaterThanOrEqual(400);
});

test("un archivo que no es imagen se rechaza sin subir nada", async ({
  page,
}) => {
  await ingresar(page, compradora);
  await page.goto("/mi-cuenta");

  const elegir = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Subir una foto" }).click();
  await (
    await elegir
  ).setFiles({
    name: "notas.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("no soy una foto"),
  });

  await expect(
    page.getByText("Ese archivo no es una imagen JPG, PNG ni WEBP."),
  ).toBeVisible();
  expect(await claveGuardada()).toBeNull();
});
