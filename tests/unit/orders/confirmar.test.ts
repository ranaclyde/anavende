import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, test, vi } from "vitest";

import { domainError } from "@/lib/errors";
import { leerErrores } from "@/lib/form";

/**
 * F6.1 — la acción que confirma el pedido. RF-11 · TS §6.2, §8.4.
 *
 * Lo que se prueba acá es lo que la acción agrega sobre la creación de orden,
 * que ya tiene sus tests contra Postgres (`crear.test.ts`): el email
 * verificado, la dirección que solo pide el envío, y qué le pasa a la
 * creación. La sesión y la creación se simulan, como en el test del
 * envoltorio: armar una sesión de verdad pediría GoTrue y cookies.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
const crear = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/modules/orders/crear", () => ({
  crearOrdenDesdeCarrito: crear.fn,
}));

const { confirmarPedido } = await import("@/modules/orders/actions");

function unaSesion({ verificado = true } = {}) {
  return {
    identity: {
      userId: "u1",
      email: "ana@ejemplo.test",
      emailVerified: verificado,
    },
    role: "customer",
    profile: {
      id: "u1",
      email: "ana@ejemplo.test",
      isBanned: false,
      banReason: null,
      closureRequestedAt: null,
    },
  };
}

const DIRECCION = randomUUID();
const VARIANTE = randomUUID();

function pedido(cambios: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    nombre: "Ana Pérez",
    telefono: "2920 55 5555",
    entrega: "envio",
    addressId: DIRECCION,
    esperado: [{ variantId: VARIANTE, unitPrice: "1000.00", quantity: 1 }],
    ...cambios,
  } as Parameters<typeof confirmarPedido>[0];
}

beforeEach(() => {
  sesion.actual = unaSesion();
  crear.fn.mockReset();
  crear.fn.mockResolvedValue({
    orderId: "o1",
    orderNumber: 1043,
    yaExistia: false,
  });
});

describe("lo que tiene que funcionar", () => {
  test("el envío lleva la dirección elegida, y el teléfono sale normalizado", async () => {
    const r = await confirmarPedido(pedido());

    expect(r).toEqual({ ok: true, data: { numero: 1043 } });
    expect(crear.fn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        entrega: { tipo: "envio", addressId: DIRECCION },
        customerName: "Ana Pérez",
        customerEmail: "ana@ejemplo.test",
        customerPhone: "+5492920555555",
      }),
    );
  });

  test("el retiro no pide dirección, y no la manda aunque llegue una", async () => {
    await confirmarPedido(pedido({ entrega: "retiro" }));
    expect(crear.fn).toHaveBeenCalledWith(
      expect.objectContaining({ entrega: { tipo: "retiro" } }),
    );

    await confirmarPedido(pedido({ entrega: "retiro", addressId: undefined }));
    expect(crear.fn).toHaveBeenCalledTimes(2);
  });
});

describe("lo que no deja confirmar", () => {
  test("con el email sin verificar no se crea nada (RF-11)", async () => {
    sesion.actual = unaSesion({ verificado: false });

    const r = await confirmarPedido(pedido());

    expect(r).toMatchObject({ ok: false, code: "EMAIL_NOT_VERIFIED" });
    expect(crear.fn).not.toHaveBeenCalled();
  });

  test("el envío sin dirección se rechaza en su campo", async () => {
    const r = await confirmarPedido(pedido({ addressId: undefined }));

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(leerErrores(r).campos).toMatchObject({
      addressId: "Elegí a dónde te lo enviamos.",
    });
    expect(crear.fn).not.toHaveBeenCalled();
  });

  test("sin teléfono no hay pedido: es el canal de la venta", async () => {
    const r = await confirmarPedido(pedido({ telefono: "  " }));

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(leerErrores(r).campos).toMatchObject({
      telefono: "Necesitamos tu teléfono para coordinar la entrega.",
    });
  });

  test("la dirección borrada en otra pestaña se avisa en su campo (F6.2)", async () => {
    crear.fn.mockRejectedValue(domainError("NOT_FOUND"));

    const r = await confirmarPedido(pedido());

    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
    if (r.ok) return;
    expect(leerErrores(r)).toMatchObject({
      general: null,
      campos: {
        addressId:
          "Esa dirección ya no está en tu libreta. Elegí otra o cargá una nueva.",
      },
    });
  });

  test("la cantidad es parte de lo que vio: sin ella no se compara", async () => {
    const r = await confirmarPedido(
      pedido({ esperado: [{ variantId: VARIANTE, unitPrice: "1000.00" }] }),
    );

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(crear.fn).not.toHaveBeenCalled();
  });

  test("un precio mal formado no llega a compararse", async () => {
    const r = await confirmarPedido(
      pedido({ esperado: [{ variantId: VARIANTE, unitPrice: "1.000,00" }] }),
    );

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(crear.fn).not.toHaveBeenCalled();
  });
});
