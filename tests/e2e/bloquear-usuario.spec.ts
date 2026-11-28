import { expect, test, type Browser } from "./apoyo/test";

import { datosDePrueba, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * El usuario bloqueado ve el motivo al intentar entrar (TS §17.2, caso 5).
 * GoTrue solo contesta `user_banned`; el motivo está en
 * `user_profiles.ban_reason` y lo busca la aplicación.
 *
 * El control de antes del bloqueo está porque una contraseña mal armada en el
 * test también la dejaría afuera.
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

async function otroNavegador(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test("la administradora bloquea y la compradora ve el motivo", async ({
  page,
  browser,
}) => {
  const antes = await otroNavegador(browser);
  await ingresar(antes, compradora);
  await antes.context().close();

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

    await despues.goto("/mi-cuenta");
    await expect(despues).toHaveURL(/\/ingresar/);
  } finally {
    await despues.context().close();
  }
});
