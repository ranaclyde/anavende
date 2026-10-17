import { expect, test, type Page } from "./apoyo/test";

import { enlaceDelEmail, vaciarBuzon } from "./apoyo/buzon";
import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F10.5 — Recuperar la contraseña, sin decir si el email existe. FS RF-05,
 * RF-06; TS §16.
 *
 * El pedido pasa por una Server Action desde F10.5 (antes iba del navegador
 * directo a GoTrue), y eso es lo que más se puede romper: que el enlace del
 * email deje de abrir la sesión. Por eso se recorre entero —pedir, abrir el
 * enlace del buzón local, elegir otra contraseña y entrar con ella—.
 *
 * Y lo que RF-06 pide: la pantalla dice lo mismo para un email que no
 * existe, y también al pedir dos veces seguidas, que es el freno que GoTrue
 * solo le pone a una cuenta que existe.
 *
 * El doble pedido va **después** de seguir el enlace: en el stack local la
 * plantilla es la de Supabase, con PKCE, y el segundo pedido reemplaza la
 * clave de la cookie. La de producción usa `token_hash` y no depende de eso.
 *
 * El freno de GoTrue es de un minuto por omisión —el de producción, si nadie
 * cambió `GOTRUE_SMTP_MAX_FREQUENCY`— y de un segundo en el stack local
 * (`max_frequency`), así que acá el segundo pedido puede caer adentro o no:
 * que el freno existe y solo para una cuenta real se comprobó a mano contra
 * GoTrue el 2026-10-17.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const inexistente = `e2e-nadie-${sufijo()}@ejemplo.test`;
let cuenta: Cuenta;

test.beforeAll(async () => {
  cuenta = await datos.unaCuenta("Olvidadiza");
});

test.afterAll(async () => {
  await vaciarBuzon(cuenta.email);
  await datos.desarmar();
});

async function pedirEnlace(page: Page, email: string) {
  await page.goto("/recuperar");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Mandame el enlace" }).click();
  await expect(page.getByText("Revisá tu email")).toBeVisible();
}

test("recupera la contraseña con el enlace del email", async ({
  page,
  browser,
}) => {
  await pedirEnlace(page, cuenta.email);

  await page.goto(await enlaceDelEmail(cuenta.email));
  await expect(page).toHaveURL(/\/recuperar\/nueva-contrasena/);

  const nueva = `Nueva-${sufijo()}-${sufijo()}`;
  await page.getByLabel("Contraseña nueva").fill(nueva);
  await page.getByLabel("Repetila").fill(nueva);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/\/mi-cuenta/);

  // Y entra con la nueva, desde otro navegador.
  const otro = await (await browser.newContext()).newPage();
  try {
    await ingresar(otro, { ...cuenta, password: nueva });
    await expect(otro).not.toHaveURL(/\/ingresar/);
  } finally {
    await otro.context().close();
  }
});

test("dice lo mismo exista o no, y al pedir dos veces seguidas", async ({
  page,
}) => {
  await pedirEnlace(page, inexistente);
  await pedirEnlace(page, cuenta.email);
  await pedirEnlace(page, cuenta.email);

  // Al que no existe no le llegó nada.
  await expect(enlaceDelEmail(inexistente)).rejects.toThrow(/No llegó/);
});
