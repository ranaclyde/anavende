/**
 * Borra las cuentas que nunca confirmaron el email — F10.5b, TECHNICAL-SPEC
 * §16 («las cuentas sin verificar se borran a las 48 horas»).
 *
 * **Para qué:** quien registra una dirección ajena —por error o para
 * molestar— deja ese email tomado, y la dueña de verdad no podría crear su
 * cuenta («Ya hay una cuenta con ese email», RF-05). A las 48 horas el email
 * se libera. Y las altas de un robot que pasara el captcha no se acumulan.
 *
 * **Qué se borra:** cuentas de `auth.users` sin `email_confirmed_at`, creadas
 * hace más de 48 horas. **Qué no:** las que invitó la administradora desde el
 * panel (`invited_at`, F7.6), que quedan sin confirmar hasta que la persona
 * elige su contraseña —eso lo decide Ana, decisión tuya del 2026-10-17—, y
 * cualquier cuenta con órdenes, que sin verificar no debería tener ninguna
 * (RF-11) pero que no se borra a ciegas. Borrar en `auth.users` se lleva en
 * cascada el perfil, el carrito, las direcciones y los favoritos.
 *
 * **Cómo corre:** como tarea programada de Coolify, adentro del contenedor de
 * la tienda: `node scripts/limpiar-cuentas.mjs`. Es `.mjs` por lo mismo que
 * `migrar.mjs`: en la imagen no hay TypeScript. La lógica está en
 * `limpiarCuentasSinVerificar` para que la pruebe
 * `tests/unit/usuarios/limpieza.test.ts` contra la base local.
 *
 * El log dice cuántas borró, nunca cuáles: son emails de personas.
 */
import { pathToFileURL } from "node:url";

import postgres from "postgres";

export const HORAS_DE_GRACIA = 48;

/**
 * @param {import("postgres").Sql} sql
 * @param {{ horas?: number }} [opciones]
 * @returns {Promise<number>} cuántas cuentas borró
 */
export async function limpiarCuentasSinVerificar(
  sql,
  { horas = HORAS_DE_GRACIA } = {},
) {
  const borradas = await sql`
    DELETE FROM auth.users u
     WHERE u.email_confirmed_at IS NULL
       AND u.invited_at IS NULL
       AND u.created_at < now() - make_interval(hours => ${horas})
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)
    RETURNING u.id`;
  return borradas.length;
}

// Solo cuando se corre como programa, no cuando lo importa un test.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[limpiar-cuentas] Falta DATABASE_URL.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const n = await limpiarCuentasSinVerificar(sql);
    console.log(
      `[limpiar-cuentas] ${n} cuenta(s) sin verificar de más de ${HORAS_DE_GRACIA} horas borrada(s).`,
    );
  } catch (e) {
    console.error("[limpiar-cuentas] Falló:", e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
