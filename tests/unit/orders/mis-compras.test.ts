import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import { contadores, limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import {
  agregarAlCarrito,
  limpiarCompradores,
  unComprador,
  type Comprador,
} from "@/tests/apoyo/compradores";
import { historial, limpiarOrdenes } from "@/tests/apoyo/ordenes";

/**
 * F6.5 — «Mis compras» y la cancelación por el comprador.
 * RF-07, RF-23, RF-34 · TS §8.1, §13.8.
 *
 * «Hecho cuando»: historial con los precios de la orden (snapshot) y cancelar
 * libera la reserva.
 *
 * **La sesión se simula y la base es de verdad.** Armar una sesión real pediría
 * GoTrue y cookies (como en `confirmar.test.ts`), pero lo que hay que probar
 * acá —que la reserva vuelva, que el historial diga quién canceló, que la
 * orden de otro no exista— vive en Postgres y no se reproduce con un doble.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

/**
 * `refresh()` lanza si no lo llaman desde una Server Action de verdad, y acá
 * la acción se invoca como una función. Se simula por lo mismo que la sesión:
 * lo que importa es lo que pasa en Postgres, y que la pantalla se vuelva a
 * pedir es asunto de Next. Es la misma convención que ya usan las acciones de
 * direcciones (F5.3).
 */
vi.mock("next/cache", () => ({ refresh: () => undefined }));

const { cancelarMiOrden } = await import("@/modules/orders/actions");
const { crearOrdenDesdeCarrito } = await import("@/modules/orders/crear");
const { leerMisCompras, leerOrdenDelComprador } =
  await import("@/modules/orders/queries");

function comoSesionDe(userId: string) {
  sesion.actual = {
    identity: { userId, email: "rosa@ejemplo.test", emailVerified: true },
    role: "customer",
    profile: {
      id: userId,
      email: "rosa@ejemplo.test",
      isBanned: false,
      banReason: null,
      closureRequestedAt: null,
    },
  };
}

afterEach(async () => {
  sesion.actual = null;
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

async function ordenDe(
  comprador: Comprador,
  variantId: string,
  cantidad: number,
): Promise<{ orderId: string; numero: number }> {
  await agregarAlCarrito(comprador.cartId, variantId, cantidad);
  const { orderId, orderNumber } = await crearOrdenDesdeCarrito({
    userId: comprador.userId,
    idempotencyKey: randomUUID(),
    entrega: { tipo: "envio", addressId: comprador.addressId },
    customerName: "Rosa Pereyra",
    customerEmail: "rosa@ejemplo.test",
    customerPhone: "+5492920111111",
    esperado: [{ variantId, unitPrice: "1000.00", quantity: cantidad }],
  });
  return { orderId, numero: orderNumber };
}

describe("el historial", () => {
  test("trae las compras del comprador, de la más nueva a la más vieja", async () => {
    const comprador = await unComprador();
    const primera = await ordenDe(
      comprador,
      (await unaVariante({ total: 10 })).variantId,
      1,
    );
    const segunda = await ordenDe(
      comprador,
      (await unaVariante({ total: 10 })).variantId,
      2,
    );

    const { compras, total } = await leerMisCompras(comprador.userId);

    expect(total).toBe(2);
    expect(compras.map((c) => c.numero)).toEqual([
      segunda.numero,
      primera.numero,
    ]);
    expect(compras[0]).toMatchObject({ estado: "activa", unidades: 2 });
    // El precio del snapshot, no el del catálogo de hoy.
    expect(compras[0].total).toBe("2000.00");
  });

  test("el resumen dice qué se compró y cuántos más hay", async () => {
    const comprador = await unComprador();
    const uno = await unaVariante({ total: 10 });
    const otro = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, uno.variantId, 1);
    await agregarAlCarrito(comprador.cartId, otro.variantId, 1);
    await crearOrdenDesdeCarrito({
      userId: comprador.userId,
      idempotencyKey: randomUUID(),
      entrega: { tipo: "retiro" },
      customerName: "Rosa Pereyra",
      customerEmail: null,
      customerPhone: "+5492920111111",
      esperado: [
        { variantId: uno.variantId, unitPrice: "1000.00", quantity: 1 },
        { variantId: otro.variantId, unitPrice: "1000.00", quantity: 1 },
      ],
    });

    const { compras } = await leerMisCompras(comprador.userId);
    expect(compras[0].resumen).toMatch(/ y 1 más$/);

    // Con un solo renglón no dice «y 0 más».
    const solo = await unComprador();
    await ordenDe(solo, (await unaVariante({ total: 5 })).variantId, 1);
    const otras = await leerMisCompras(solo.userId);
    expect(otras.compras[0].resumen).not.toMatch(/más/);
  });

  test("no trae las compras de otro", async () => {
    const comprador = await unComprador();
    const ajeno = await unComprador();
    await ordenDe(comprador, (await unaVariante({ total: 5 })).variantId, 1);

    expect((await leerMisCompras(ajeno.userId)).total).toBe(0);
  });

  test("pagina, y la segunda página no repite la primera", async () => {
    const comprador = await unComprador();
    for (let i = 0; i < 3; i++) {
      await ordenDe(comprador, (await unaVariante({ total: 5 })).variantId, 1);
    }

    const p1 = await leerMisCompras(comprador.userId, {
      pagina: 1,
      porPagina: 2,
    });
    const p2 = await leerMisCompras(comprador.userId, {
      pagina: 2,
      porPagina: 2,
    });

    expect(p1.total).toBe(3);
    expect(p1.compras).toHaveLength(2);
    expect(p2.compras).toHaveLength(1);
    expect(p1.compras.map((c) => c.numero)).not.toContain(p2.compras[0].numero);
  });

  test("el detalle trae el estado y la fecha (RF-07)", async () => {
    const comprador = await unComprador();
    const { numero } = await ordenDe(
      comprador,
      (await unaVariante({ total: 5 })).variantId,
      1,
    );

    const orden = await leerOrdenDelComprador(comprador.userId, numero);
    expect(orden!.estado).toBe("activa");
    expect(Number.isNaN(Date.parse(orden!.creadaEn))).toBe(false);
  });
});

describe("el arrepentimiento (RF-23, RF-34)", () => {
  test("cancelar libera la reserva y no toca el stock real", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });
    const { orderId, numero } = await ordenDe(comprador, variantId, 3);

    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 3,
    });

    comoSesionDe(comprador.userId);
    const r = await cancelarMiOrden({ numero });

    expect(r).toEqual({ ok: true, data: { cancelada: numero } });
    // La reserva vuelve; el stock real nunca se descontó (§8.1).
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });

    const [fila] = await db.execute<{ status: string; cancelada: string }>(sql`
      SELECT status, cancelled_at AS cancelada FROM orders WHERE id = ${orderId}`);
    expect(fila.status).toBe("cancelada");
    expect(fila.cancelada).not.toBeNull();
  });

  test("queda registrado que canceló el comprador, y no la vendedora", async () => {
    const comprador = await unComprador();
    const { orderId, numero } = await ordenDe(
      comprador,
      (await unaVariante({ total: 5 })).variantId,
      1,
    );

    comoSesionDe(comprador.userId);
    await cancelarMiOrden({ numero });

    // El autor es lo que después, en el panel, distingue un arrepentimiento
    // de una cancelación de la administradora (RF-23).
    expect(await historial(orderId)).toMatchObject([
      { fromStatus: null, toStatus: "activa" },
      {
        fromStatus: "activa",
        toStatus: "cancelada",
        actorUserId: comprador.userId,
      },
    ]);
  });

  test("la orden de otro responde como una que no existe (§13.8)", async () => {
    const comprador = await unComprador();
    const ajeno = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    const { numero } = await ordenDe(comprador, variantId, 2);

    comoSesionDe(ajeno.userId);
    const r = await cancelarMiOrden({ numero });

    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ code: "NOT_FOUND" });
    // Y la reserva del dueño sigue en pie.
    expect(await contadores(variantId)).toMatchObject({ reservedStock: 2 });

    // Un número que no existe da exactamente lo mismo: no se puede distinguir
    // «no es tuya» de «no existe».
    const inventada = await cancelarMiOrden({ numero: 999_999 });
    expect(inventada).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  test("cancelar dos veces no libera dos veces (RF-13)", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });
    const { numero } = await ordenDe(comprador, variantId, 2);

    comoSesionDe(comprador.userId);
    expect((await cancelarMiOrden({ numero })).ok).toBe(true);

    const segunda = await cancelarMiOrden({ numero });
    expect(segunda).toMatchObject({ ok: false, code: "INVALID_ORDER_STATE" });
    // Lo que importa: la reserva volvió UNA vez, no dos.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
  });
});
