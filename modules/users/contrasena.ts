import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Se compara contra el hash de `auth.users` con `crypt()` y no ingresando en
 * GoTrue: con el captcha prendido el ingreso exige un token de Turnstile, y a
 * una cuenta bloqueada la rechaza antes de mirar la contraseña. Se pierde su
 * límite de intentos: quien llama pone el suyo (`rateLimitOrThrow`).
 */
export async function coincideLaContrasena(
  email: string,
  password: string,
): Promise<boolean> {
  const [fila] = await db.execute<{ coincide: boolean }>(sql`
    SELECT encrypted_password <> ''
           AND encrypted_password =
               extensions.crypt(${password}, encrypted_password) AS coincide
      FROM auth.users
     WHERE lower(email) = lower(${email})
     LIMIT 1`);
  return fila?.coincide === true;
}
