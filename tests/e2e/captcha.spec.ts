import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./apoyo/test";

import { sufijo } from "./apoyo/datos";

/**
 * F10.5b — Sin Turnstile no hay alta, ni ingreso, ni recuperación, ni
 * reenvío. TS §16; DEVELOPMENT-PLAN F10.5b: «un alta sin token de Turnstile
 * se rechaza».
 *
 * El captcha lo hace cumplir GoTrue (`[auth.captcha]` en
 * `supabase/config.toml`, con el secreto de prueba de Cloudflare), no la
 * pantalla: por eso la primera mitad le pega a GoTrue directo, como lo haría
 * un programa que se saltea la tienda. La segunda mira que las cuatro
 * pantallas tengan el widget y que el botón espere su token.
 *
 * El resto de la suite pasa por el widget de verdad cada vez que ingresa o da
 * de alta: si el token no viajara, esos recorridos fallarían.
 */

const SCRIPT_DE_TURNSTILE =
  /^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/;

const gotrue = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
).auth;

test("GoTrue rechaza las cuatro sin token", async () => {
  const email = `e2e-captcha-${sufijo()}@ejemplo.test`;

  const alta = await gotrue.signUp({ email, password: `Prueba-${sufijo()}` });
  const ingreso = await gotrue.signInWithPassword({ email, password: "x" });
  const recuperacion = await gotrue.resetPasswordForEmail(email);
  const reenvio = await gotrue.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  for (const [nombre, { error }] of Object.entries({
    alta,
    ingreso,
    recuperacion,
    reenvio,
  })) {
    expect(error?.code, nombre).toBe("captcha_failed");
  }
});

test("las pantallas cargan el widget y el botón se habilita con el token", async ({
  page,
}) => {
  for (const [ruta, boton] of [
    ["/ingresar", "Ingresar"],
    ["/registro", "Crear cuenta"],
    ["/recuperar", "Mandame el enlace"],
  ] as const) {
    // El iframe de Turnstile vive en un shadow DOM cerrado, que Playwright
    // no ve: lo que se mira es que la pantalla cargue su script.
    const script = page.waitForRequest(SCRIPT_DE_TURNSTILE);
    await page.goto(ruta);
    await script;

    // Con la clave de prueba el token llega solo, y el botón se habilita.
    await expect(page.getByRole("button", { name: boton }), ruta).toBeEnabled({
      timeout: 15_000,
    });
  }

  // El reenvío de «Revisá tu email».
  const script = page.waitForRequest(SCRIPT_DE_TURNSTILE);
  await page.goto("/registro/verificar?email=alguien%40ejemplo.test");
  await script;
  await expect(
    page.getByRole("button", { name: "No me llegó, reenviar" }),
  ).toBeEnabled({ timeout: 15_000 });
});

test("sin el script de Cloudflare el botón no se habilita, y se dice por qué", async ({
  page,
}) => {
  // Lo que pasa con un bloqueador de anuncios o sin conexión a Cloudflare.
  await page.route(SCRIPT_DE_TURNSTILE, (ruta) => ruta.abort());
  await page.goto("/ingresar");

  const boton = page.getByRole("button", { name: "Ingresar" });
  await expect(
    page.getByText("No pudimos cargar la verificación", { exact: false }),
  ).toBeVisible();
  await expect(boton).toBeDisabled();
  // El aviso está atado al botón: un lector de pantalla lo lee con él.
  await expect(boton).toHaveAccessibleDescription(
    /No pudimos cargar la verificación/,
  );
});
