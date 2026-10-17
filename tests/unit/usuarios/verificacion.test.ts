import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { emailConfirmado } from "@/modules/users/verificacion";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * F10.5 — RF-11 se decide con la base, no con la sesión.
 *
 * El token de GoTrue trae `email_verified` dentro de `user_metadata`, que el
 * usuario puede escribir. Lo que vale es `auth.users.email_confirmed_at`, que
 * solo escribe GoTrue al confirmar el enlace.
 */

afterEach(() => limpiarCompradores());

describe("emailConfirmado", () => {
  test("sin confirmar es no, aunque el metadata diga que sí", async () => {
    const c = await unComprador();
    await db.execute(sql`
      UPDATE auth.users
         SET email_confirmed_at = NULL,
             raw_user_meta_data = '{"email_verified": true}'::jsonb
       WHERE id = ${c.userId}`);

    expect(await emailConfirmado(c.userId)).toBe(false);
  });

  test("confirmado es sí", async () => {
    const c = await unComprador();
    await db.execute(sql`
      UPDATE auth.users SET email_confirmed_at = now() WHERE id = ${c.userId}`);

    expect(await emailConfirmado(c.userId)).toBe(true);
  });

  test("un id que no existe es no", async () => {
    expect(await emailConfirmado("00000000-0000-0000-0000-000000000000")).toBe(
      false,
    );
  });
});
