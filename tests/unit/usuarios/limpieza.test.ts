import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { limpiarCuentasSinVerificar } from "@/scripts/limpiar-cuentas.mjs";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * F10.5b — La limpieza de cuentas sin verificar. TS §16;
 * `scripts/limpiar-cuentas.mjs`.
 *
 * **Con una ventana de 10.000 horas, no de 48**, y las cuentas de prueba
 * fechadas antes que eso. La limpieza borra de verdad en la base que lee
 * `next dev`: con 48 horas se llevaría también cualquier cuenta sin verificar
 * que haya quedado de probar a mano. Así solo pueden caer las de este test.
 */

const HORAS = 10_000; // unos 417 días
const conexion = postgres(process.env.DATABASE_URL!, { max: 1 });

afterEach(() => limpiarCompradores());
afterAll(() => conexion.end());

/** Una cuenta con la fecha de alta y el estado que haga falta. */
async function unaCuenta({
  diasAtras,
  confirmada = false,
  invitada = false,
}: {
  diasAtras: number;
  confirmada?: boolean;
  invitada?: boolean;
}): Promise<string> {
  const { userId } = await unComprador();
  await db.execute(sql`
    UPDATE auth.users
       SET created_at = now() - make_interval(days => ${diasAtras}),
           email_confirmed_at = CASE WHEN ${confirmada} THEN now() END,
           invited_at = CASE WHEN ${invitada} THEN now() END
     WHERE id = ${userId}`);
  return userId;
}

async function existe(
  userId: string,
): Promise<{ cuenta: boolean; perfil: boolean }> {
  const [fila] = await db.execute<{ cuenta: boolean; perfil: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = ${userId}) AS cuenta,
           EXISTS (SELECT 1 FROM user_profiles WHERE id = ${userId}) AS perfil`);
  return fila;
}

describe("limpiarCuentasSinVerificar", () => {
  test("borra la vieja sin verificar, con su perfil, y nada más", async () => {
    const vieja = await unaCuenta({ diasAtras: 500 });
    const nueva = await unaCuenta({ diasAtras: 300 });
    const confirmada = await unaCuenta({ diasAtras: 500, confirmada: true });
    const invitada = await unaCuenta({ diasAtras: 500, invitada: true });

    const conOrden = await unaCuenta({ diasAtras: 500 });
    await db.execute(sql`
      INSERT INTO orders
        (user_id, origin, status, customer_name, customer_phone, total)
      VALUES (${conOrden}, 'web', 'cancelada', 'Compradora', '+5491155550000',
              '0.00')`);

    const borradas = await limpiarCuentasSinVerificar(conexion, {
      horas: HORAS,
    });

    expect(borradas).toBe(1);
    expect(await existe(vieja)).toEqual({ cuenta: false, perfil: false });
    for (const queda of [nueva, confirmada, invitada, conOrden]) {
      expect(await existe(queda)).toEqual({ cuenta: true, perfil: true });
    }
  });

  test("corrida dos veces seguidas, la segunda no borra nada", async () => {
    await unaCuenta({ diasAtras: 500 });

    expect(await limpiarCuentasSinVerificar(conexion, { horas: HORAS })).toBe(
      1,
    );
    expect(await limpiarCuentasSinVerificar(conexion, { horas: HORAS })).toBe(
      0,
    );
  });
});
