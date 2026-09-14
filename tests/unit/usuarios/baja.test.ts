import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  contarBajasPendientes,
  mensajeDeOrdenesActivas,
  ordenesActivas,
  pedirBaja,
  retirarBaja,
} from "@/modules/users/baja/operaciones";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * F5.8 — pedir la baja de la cuenta. RF-34, RN-13 · TS §13.5b.
 *
 * Que con la baja pedida la cuenta sea de solo lectura lo hace cumplir el
 * envoltorio de acciones (`lib/action.ts`, paso 2b), que mira la columna que
 * estas operaciones escriben. El envoltorio no tiene tests propios —necesita
 * una sesión, y las pruebas de dominio no la arman—: está anotado en PROGRESO.
 */

afterEach(async () => {
  await limpiarCompradores();
});

async function estado(userId: string) {
  const [fila] = await db.execute<{ pedidaEl: string | null; motivo: string | null }>(sql`
    SELECT closure_requested_at AS "pedidaEl", closure_reason AS motivo
      FROM user_profiles WHERE id = ${userId}`);
  return fila;
}

/** Una orden web activa del comprador. `limpiarCompradores` la borra. */
async function unaOrdenActivaDe(userId: string): Promise<number> {
  const [orden] = await db.execute<{ numero: number }>(sql`
    INSERT INTO orders (origin, status, customer_name, customer_phone, user_id)
    VALUES ('web', 'activa', 'Compradora', '+5491155550000', ${userId})
    RETURNING order_number AS numero`);
  return orden.numero;
}

describe("pedir la baja", () => {
  test("queda pedida, con fecha y motivo", async () => {
    const { userId } = await unComprador();

    const { pedidaEl } = await pedirBaja(userId, "Ya no compro por acá");

    expect(pedidaEl).toEqual(expect.any(String));
    expect(await estado(userId)).toEqual({
      pedidaEl,
      motivo: "Ya no compro por acá",
    });
  });

  test("pedirla dos veces no pisa el motivo del primer pedido", async () => {
    const { userId } = await unComprador();

    const primera = await pedirBaja(userId, "El primero");
    const segunda = await pedirBaja(userId, "El segundo");

    expect(segunda.pedidaEl).toEqual(primera.pedidaEl);
    expect((await estado(userId)).motivo).toBe("El primero");
  });

  test("con órdenes activas no procede, y dice cuáles", async () => {
    const { userId } = await unComprador();
    const numero = await unaOrdenActivaDe(userId);

    await expect(pedirBaja(userId, "Me voy")).rejects.toMatchObject({
      code: "ACCOUNT_HAS_ACTIVE_ORDERS",
      message: mensajeDeOrdenesActivas([{ numero }]),
      details: { ordenes: [numero] },
    });
    expect(await ordenesActivas(userId)).toEqual([{ numero }]);
    expect((await estado(userId)).pedidaEl).toBeNull();
  });

  test("una administradora no la pide desde la tienda", async () => {
    const { userId } = await unComprador();
    await db.execute(sql`UPDATE user_profiles SET role = 'admin' WHERE id = ${userId}`);

    await expect(pedirBaja(userId, "Me voy")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await estado(userId)).pedidaEl).toBeNull();
  });

  test("el motivo lo exige la base, no solo el formulario", async () => {
    const { userId } = await unComprador();

    await expect(
      db.execute(sql`
        UPDATE user_profiles SET closure_requested_at = now() WHERE id = ${userId}`),
    ).rejects.toThrow();
  });
});

describe("retirar el pedido", () => {
  test("deja la cuenta como estaba, y retirar sin pedido no es un error", async () => {
    const { userId } = await unComprador();
    await pedirBaja(userId, "Me voy");

    expect(await retirarBaja(userId)).toEqual({ retirada: true });
    expect(await estado(userId)).toEqual({ pedidaEl: null, motivo: null });
    expect(await retirarBaja(userId)).toEqual({ retirada: false });
  });

  test("después de retirarla se puede volver a pedir, con otro motivo", async () => {
    const { userId } = await unComprador();
    await pedirBaja(userId, "El primero");
    await retirarBaja(userId);

    await pedirBaja(userId, "El segundo");

    expect((await estado(userId)).motivo).toBe("El segundo");
  });
});

describe("el panel", () => {
  test("cuenta las bajas pedidas, y las retiradas dejan de contar", async () => {
    const antes = await contarBajasPendientes();
    const ana = await unComprador();
    const otra = await unComprador();

    await pedirBaja(ana.userId, "Me voy");
    await pedirBaja(otra.userId, "Yo también");
    expect(await contarBajasPendientes()).toBe(antes + 2);

    await retirarBaja(otra.userId);
    expect(await contarBajasPendientes()).toBe(antes + 1);
  });
});

describe("el mensaje de las órdenes activas (RF-34)", () => {
  test("dice cuántas y cuáles, en singular y en plural", () => {
    expect(mensajeDeOrdenesActivas([{ numero: 12 }])).toBe(
      "Tenés 1 orden activa (la #12). Podés cancelarla desde «Mis compras» o esperar a que se finalice, y después pedir la baja.",
    );
    expect(mensajeDeOrdenesActivas([{ numero: 12 }, { numero: 15 }])).toBe(
      "Tenés 2 órdenes activas (la #12 y la #15). Podés cancelarlas desde «Mis compras» o esperar a que se finalicen, y después pedir la baja.",
    );
    expect(
      mensajeDeOrdenesActivas([{ numero: 1 }, { numero: 2 }, { numero: 3 }]),
    ).toContain("(la #1, la #2 y la #3)");
  });
});
