import { expect, test, type Browser } from "@playwright/test";

import { datosDePrueba, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F10.2 — La administradora bloquea a un usuario y ese usuario ve el motivo
 * al intentar entrar. TS §17.2, caso 5; FS RF-27.
 *
 * El motivo no existe en Supabase Auth (`user_profiles.ban_reason`): GoTrue
 * solo sabe que la cuenta está bloqueada y contesta `user_banned`, y es la
 * aplicación la que busca el motivo y lo muestra. Por eso lo que se mira es
 * **el texto que escribió la administradora**, en la pantalla de ingreso de
 * la compradora.
 *
 * Con su control: antes del bloqueo, la misma compradora entra con la misma
 * contraseña. Sin eso, una contraseña mal armada en el test también la
 * dejaría afuera.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const motivo =
  "Tres pedidos confirmados que nunca se retiraron. Escribinos para reactivarla.";
let admin: Cuenta;
let compradora: Cuenta;

test.beforeAll(async () => {
  admin = await datos.unaCuenta("Ana", "admin");
  compradora = await datos.unaCuenta("Compradora");
});

test.afterAll(async () => {
  await datos.desarmar();
});

/** Un navegador aparte para la compradora: no comparte la sesión de Ana. */
async function otroNavegador(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test("la administradora bloquea y la compradora ve el motivo", async ({
  page,
  browser,
}) => {
  // Control: antes del bloqueo, entra.
  const antes = await otroNavegador(browser);
  await ingresar(antes, compradora);
  await antes.context().close();

  // El bloqueo, desde la ficha del usuario.
  await ingresar(page, admin);
  await page.goto(`/admin/usuarios/${compradora.id}`);
  await page.getByRole("button", { name: "Bloquear la cuenta" }).click();

  const dialogo = page.getByRole("dialog", {
    name: `Bloquear la cuenta de ${compradora.nombre}`,
  });
  await dialogo.getByLabel("¿Por qué la bloqueás?").fill(motivo);
  await dialogo.getByRole("button", { name: "Sí, bloquear" }).click();
  await expect(dialogo).toBeHidden();

  const [perfil] = await datos.sql<
    { is_banned: boolean; ban_reason: string; banned_by: string }[]
  >`
    SELECT is_banned, ban_reason, banned_by FROM user_profiles
     WHERE id = ${compradora.id}`;
  expect(perfil).toEqual({
    is_banned: true,
    ban_reason: motivo,
    banned_by: admin.id,
  });

  // La compradora intenta entrar.
  const despues = await otroNavegador(browser);
  try {
    await despues.goto("/ingresar");
    await despues.getByLabel("Email").fill(compradora.email);
    await despues.getByLabel("Contraseña").fill(compradora.password);
    await despues.getByRole("button", { name: "Ingresar" }).click();

    await expect(despues.getByText("Tu cuenta está bloqueada")).toBeVisible();
    await expect(
      despues.getByText(`Motivo registrado: ${motivo}`),
    ).toBeVisible();
    await expect(despues).toHaveURL(/\/ingresar/);

    // Y no quedó con sesión: la cuenta la manda de vuelta a ingresar.
    await despues.goto("/mi-cuenta");
    await expect(despues).toHaveURL(/\/ingresar/);
  } finally {
    await despues.context().close();
  }
});
