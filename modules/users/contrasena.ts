import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * ¿Es esta la contraseña de la cuenta? Comparada en la base contra el hash
 * que guarda GoTrue (bcrypt, `$2a$`), con `crypt()` de `pgcrypto` — F10.5,
 * F10.5b.
 *
 * **Por qué no se le pregunta a GoTrue ingresando**, que era lo que se hacía:
 * - Con el captcha prendido (F10.5b, `GOTRUE_SECURITY_CAPTCHA_*`), GoTrue
 *   exige un token de Turnstile también para ingresar con contraseña, y una
 *   comprobación hecha por el servidor no tiene uno.
 * - A una cuenta bloqueada o dada de baja GoTrue la rechaza **antes** de mirar
 *   la contraseña (`user_banned`), así que ahí no hay a quién preguntarle.
 *
 * Lo que se pierde es el límite de intentos de GoTrue: quien llama pone el
 * suyo (`frenarSiInsiste`). Una cuenta sin contraseña —la de Google o
 * Facebook que nunca la definió— tiene el hash vacío y nunca coincide.
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
