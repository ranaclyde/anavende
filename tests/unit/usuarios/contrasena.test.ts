import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, test } from "vitest";

import { createServiceClient } from "@/lib/supabase/service";
import { coincideLaContrasena } from "@/modules/users/contrasena";

/**
 * La contraseña se compara en la base contra el hash de GoTrue: con el
 * captcha prendido no se le puede preguntar a GoTrue ingresando. La cuenta se
 * crea por la API de GoTrue, para que el hash sea el que GoTrue escribió.
 */

const creadas: string[] = [];

afterEach(async () => {
  for (const id of creadas.splice(0)) {
    await createServiceClient().auth.admin.deleteUser(id);
  }
});

async function unaCuenta(password?: string): Promise<string> {
  const email = `contrasena-${randomUUID().slice(0, 8)}@ejemplo.test`;
  const { data, error } = await createServiceClient().auth.admin.createUser({
    email,
    email_confirm: true,
    ...(password ? { password } : {}),
  });
  if (error || !data.user) throw error ?? new Error("no se creó la cuenta");
  creadas.push(data.user.id);
  return email;
}

describe("coincideLaContrasena", () => {
  test("la correcta sí, otra no", async () => {
    const email = await unaCuenta("La-de-siempre-123");

    expect(await coincideLaContrasena(email, "La-de-siempre-123")).toBe(true);
    expect(await coincideLaContrasena(email, "la-de-siempre-123")).toBe(false);
    expect(await coincideLaContrasena(email, "")).toBe(false);
  });

  test("el email sin importar mayúsculas, como en GoTrue", async () => {
    const email = await unaCuenta("La-de-siempre-123");

    expect(
      await coincideLaContrasena(email.toUpperCase(), "La-de-siempre-123"),
    ).toBe(true);
  });

  test("una cuenta sin contraseña nunca coincide", async () => {
    // La de Google o Facebook que nunca la definió: el hash queda vacío.
    const email = await unaCuenta();

    expect(await coincideLaContrasena(email, "")).toBe(false);
    expect(await coincideLaContrasena(email, "cualquiera")).toBe(false);
  });

  test("un email que no existe no coincide", async () => {
    expect(
      await coincideLaContrasena("nadie-en-absoluto@ejemplo.test", "x"),
    ).toBe(false);
  });
});
