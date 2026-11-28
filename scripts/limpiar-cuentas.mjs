/**
 * Borra las cuentas que nunca confirmaron el email (TECHNICAL-SPEC §16) y
 * libera ese email. Corre como tarea programada de Coolify, adentro del
 * contenedor de la tienda, contra la base de producción:
 * `node scripts/limpiar-cuentas.mjs`.
 *
 * BORRA de `auth.users`, con cascada a perfil, carrito, direcciones y
 * favoritos. No toca las invitadas desde el panel (`invited_at`) ni las que
 * tienen órdenes. El log dice cuántas, nunca cuáles: son emails de personas.
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
