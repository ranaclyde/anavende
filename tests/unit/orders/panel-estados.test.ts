import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, test, vi } from "vitest";

import { contadores, limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import {
  agregarAlCarrito,
  limpiarCompradores,
  unComprador,
  type Comprador,
} from "@/tests/apoyo/compradores";
import {
  estadoDeLaOrden,
  historial,
  limpiarOrdenes,
} from "@/tests/apoyo/ordenes";

/**
 * F7.3 — Finalizar y cancelar desde el panel. RF-23, RF-13 · TS §8.1.
 *
 * «Hecho cuando»: finalizar pide confirmación mostrando el impacto en stock.
 * La confirmación es del diálogo; lo que se prueba acá es que lo que el
 * diálogo promete sea lo que la acción hace.
 *
 * **Otra vez la puerta y no la lógica.** La máquina de estados está probada
 * contra Postgres en `estados.test.ts` desde F4.2 —el `UPDATE` condicional,
 * los contadores, el historial, las dos transiciones simultáneas—. Lo que
 * F7.3 agrega y puede romperse sin que nadie lo note es el envoltorio: que
 * sólo entre la administradora, que el número de la URL lleve a la orden
 * correcta, que el motivo opcional no termine guardado como cadena vacía, y
 * que una orden ya resuelta no admita una segunda vuelta (RF-13).
 *
 * **Y una cosa más, que no es del panel**: que el comprador vea quién le
 * canceló el pedido. Hasta F7.3 el único que podía cancelar era él.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

/** `refresh()` lanza fuera de una Server Action de verdad (precedente: F5.3). */
vi.mock("next/cache", () => ({ refresh: () => undefined }));

const { cancelarLaOrden, finalizarLaOrden } =
  await import("@/modules/orders/actions-panel");
const { cancelarMiOrden } = await import("@/modules/orders/actions");
const { crearOrdenDesdeCarrito } = await import("@/modules/orders/crear");
const { leerOrdenDelComprador } = await import("@/modules/orders/queries");
const { leerOrdenDelPanel } = await import("@/modules/orders/queries-panel");

function comoSesion(userId: string, role: "admin" | "customer") {
  sesion.actual = {
    identity: { userId, email: "ana@ejemplo.test", emailVerified: true },
    role,
    profile: {
      id: userId,
      email: "ana@ejemplo.test",
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

/** Una orden web `activa` de un renglón, con el stock que se le pida. */
async function unaOrdenDe(
  comprador: Comprador,
  { stock, cantidad }: { stock: number; cantidad: number },
): Promise<{ numero: number; orderId: string; variantId: string }> {
  const { variantId } = await unaVariante({ total: stock });
  await agregarAlCarrito(comprador.cartId, variantId, cantidad);

  const { orderId, orderNumber } = await crearOrdenDesdeCarrito({
    userId: comprador.userId,
    idempotencyKey: randomUUID(),
    entrega: { tipo: "retiro" },
    customerName: "Rosa Pereyra",
    customerEmail: "rosa@ejemplo.test",
    customerPhone: "+5492920111111",
    esperado: [{ variantId, unitPrice: "1000.00", quantity: cantidad }],
  });

  return { numero: orderNumber, orderId, variantId };
}

describe("quién puede resolver una orden", () => {
  test("sin sesión no se finaliza ni se cancela", async () => {
    const comprador = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 10, cantidad: 2 });

    expect(await finalizarLaOrden({ numero: orden.numero })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await cancelarLaOrden({ numero: orden.numero })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });

    // Y el rechazo es antes de tocar nada: la reserva sigue donde estaba.
    expect(await contadores(orden.variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 2,
    });
    expect(await estadoDeLaOrden(orden.orderId)).toMatchObject({
      status: "activa",
    });
  });

  test("el comprador no finaliza la suya, aunque pueda cancelarla", async () => {
    const comprador = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 10, cantidad: 2 });

    comoSesion(comprador.userId, "customer");

    // Finalizar es afirmar que se entregó, y eso lo dice la vendedora.
    expect(await finalizarLaOrden({ numero: orden.numero })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    // Cancelar por el panel tampoco: lo suyo es `cancelarMiOrden` (F6.5),
    // que busca por dueño además de por número (§13.8).
    expect(await cancelarLaOrden({ numero: orden.numero })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await estadoDeLaOrden(orden.orderId)).toMatchObject({
      status: "activa",
    });
  });

  test("un número que no existe no encuentra nada", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(await finalizarLaOrden({ numero: 999_999_999 })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await cancelarLaOrden({ numero: 999_999_999 })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("finalizar (RF-23)", () => {
  test("descuenta el stock real, suelta la reserva y deja quién fue", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 10, cantidad: 3 });

    comoSesion(ana.userId, "admin");
    const r = await finalizarLaOrden({ numero: orden.numero });

    expect(r).toEqual({ ok: true, data: { numero: orden.numero } });

    // Lo que promete el diálogo: el stock baja y el disponible queda igual.
    // Antes: 10 − 3 reservadas = 7 disponibles. Después: 7 − 0 = 7.
    expect(await contadores(orden.variantId)).toEqual({
      stockTotal: 7,
      reservedStock: 0,
    });

    const quedo = await estadoDeLaOrden(orden.orderId);
    expect(quedo.status).toBe("finalizada");
    expect(quedo.finalizedAt).not.toBeNull();
    expect(quedo.cancelledAt).toBeNull();

    // RF-23: autor y fecha en el historial. Sin motivo, que es de cancelar.
    expect((await historial(orden.orderId)).at(-1)).toMatchObject({
      fromStatus: "activa",
      toStatus: "finalizada",
      reason: null,
      actorUserId: ana.userId,
    });
  });

  test("una finalizada no se vuelve a finalizar ni se cancela (RF-13)", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 10, cantidad: 3 });

    comoSesion(ana.userId, "admin");
    expect(await finalizarLaOrden({ numero: orden.numero })).toMatchObject({
      ok: true,
    });

    // Dos pestañas abiertas, o dos clics. El stock no se descuenta dos veces.
    expect(await finalizarLaOrden({ numero: orden.numero })).toMatchObject({
      ok: false,
      code: "INVALID_ORDER_STATE",
    });
    expect(await cancelarLaOrden({ numero: orden.numero })).toMatchObject({
      ok: false,
      code: "INVALID_ORDER_STATE",
    });

    expect(await contadores(orden.variantId)).toEqual({
      stockTotal: 7,
      reservedStock: 0,
    });
  });
});

describe("cancelar desde el panel (RF-23)", () => {
  test("libera la reserva sin tocar el stock real, y guarda el motivo", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 10, cantidad: 4 });

    comoSesion(ana.userId, "admin");
    const r = await cancelarLaOrden({
      numero: orden.numero,
      motivo: "Nos quedamos sin stock del rojo",
    });

    expect(r).toEqual({ ok: true, data: { numero: orden.numero } });
    // Al revés de finalizar: el total no se mueve y el disponible sube.
    expect(await contadores(orden.variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });

    const quedo = await estadoDeLaOrden(orden.orderId);
    expect(quedo.status).toBe("cancelada");
    expect(quedo.cancelledAt).not.toBeNull();
    expect(quedo.finalizedAt).toBeNull();

    expect((await historial(orden.orderId)).at(-1)).toMatchObject({
      fromStatus: "activa",
      toStatus: "cancelada",
      reason: "Nos quedamos sin stock del rojo",
      actorUserId: ana.userId,
    });
  });

  test("sin motivo, o con uno en blanco, se guarda NULL y no una cadena vacía", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const sinMotivo = await unaOrdenDe(comprador, { stock: 5, cantidad: 1 });
    const enBlanco = await unaOrdenDe(comprador, { stock: 5, cantidad: 1 });

    comoSesion(ana.userId, "admin");
    expect(await cancelarLaOrden({ numero: sinMotivo.numero })).toMatchObject({
      ok: true,
    });
    // Espacios: quien abrió el campo, lo tocó y se arrepintió.
    expect(
      await cancelarLaOrden({ numero: enBlanco.numero, motivo: "   " }),
    ).toMatchObject({ ok: true });

    // Un `reason = ''` se lee como «hay un motivo» y termina en un «Motivo:»
    // sin nada al lado, en el panel y en la pantalla del comprador.
    expect((await historial(sinMotivo.orderId)).at(-1)).toMatchObject({
      reason: null,
    });
    expect((await historial(enBlanco.orderId)).at(-1)).toMatchObject({
      reason: null,
    });
  });

  test("un motivo interminable se rechaza y la orden no se toca", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 5, cantidad: 1 });

    comoSesion(ana.userId, "admin");
    const r = await cancelarLaOrden({
      numero: orden.numero,
      motivo: "x".repeat(301),
    });

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await estadoDeLaOrden(orden.orderId)).toMatchObject({
      status: "activa",
    });
    expect(await contadores(orden.variantId)).toMatchObject({
      reservedStock: 1,
    });
  });

  test("el panel la muestra cancelada, con el motivo en el historial", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 5, cantidad: 2 });

    comoSesion(ana.userId, "admin");
    await cancelarLaOrden({ numero: orden.numero, motivo: "No contestó" });

    const quedo = (await leerOrdenDelPanel(orden.numero))!;
    expect(quedo.estado).toBe("cancelada");
    // Y el historial dice que NO fue el comprador: es lo que distingue esto
    // de un arrepentimiento (RF-23, F7.1).
    expect(quedo.historial.at(-1)).toMatchObject({
      hacia: "cancelada",
      motivo: "No contestó",
      esElComprador: false,
    });
  });
});

describe("lo que ve el comprador cuando le cancelan (RF-23)", () => {
  test("la cancelación de la vendedora llega con su motivo", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 5, cantidad: 1 });

    comoSesion(ana.userId, "admin");
    await cancelarLaOrden({
      numero: orden.numero,
      motivo: "Nos quedamos sin stock del rojo",
    });

    const suya = (await leerOrdenDelComprador(comprador.userId, orden.numero))!;
    // Sin esto, la pantalla le diría «Cancelaste este pedido» a alguien a
    // quien se lo cancelaron.
    expect(suya.cancelacion).toEqual({
      porLaTienda: true,
      motivo: "Nos quedamos sin stock del rojo",
    });
  });

  test("su propio arrepentimiento no se lee como cancelación de la tienda", async () => {
    const comprador = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 5, cantidad: 1 });

    comoSesion(comprador.userId, "customer");
    expect(await cancelarMiOrden({ numero: orden.numero })).toMatchObject({
      ok: true,
    });

    const suya = (await leerOrdenDelComprador(comprador.userId, orden.numero))!;
    expect(suya.cancelacion).toEqual({ porLaTienda: false, motivo: null });
  });

  test("una orden activa no tiene cancelación que contar", async () => {
    const comprador = await unComprador();
    const orden = await unaOrdenDe(comprador, { stock: 5, cantidad: 1 });

    const suya = (await leerOrdenDelComprador(comprador.userId, orden.numero))!;
    expect(suya.cancelacion).toBeNull();
  });
});
