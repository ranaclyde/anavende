import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

/**
 * La baja pedida deja la cuenta de solo lectura, y la ejecutada la deja
 * afuera de todo. RF-34 · TS §6.2, paso 2b. Se prueba en el envoltorio porque
 * ahí vive la regla; la sesión se simula.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));

vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

const { action } = await import("@/lib/action");

function unaSesion(pidioLaBaja: boolean, dadaDeBaja = false) {
  return {
    identity: { userId: "u1" },
    role: "customer",
    profile: {
      id: "u1",
      isBanned: false,
      banReason: null,
      closureRequestedAt: pidioLaBaja ? new Date() : null,
      closedAt: dadaDeBaja ? new Date() : null,
    },
  };
}

const sinDatos = z.object({});

const comun = action
  .input(sinDatos)
  .auth("customer")
  .handler(async () => "hecho");

const permitida = action
  .input(sinDatos)
  .auth("customer")
  .evenWithPendingClosure()
  .handler(async () => "hecho");

// La marca se declara en cualquier orden y sobrevive a `input` y `auth`.
const permitidaAntes = action
  .evenWithPendingClosure()
  .input(sinDatos)
  .auth("customer")
  .handler(async () => "hecho");

const publica = action
  .input(sinDatos)
  .auth("public")
  .handler(async () => "hecho");

beforeEach(() => {
  sesion.actual = null;
});

describe("sin la baja pedida", () => {
  test("una acción de comprador anda como siempre", async () => {
    sesion.actual = unaSesion(false);
    expect(await comun({})).toEqual({ ok: true, data: "hecho" });
  });
});

describe("con la baja pedida", () => {
  test("una acción de comprador se rechaza, con el motivo y la salida", async () => {
    sesion.actual = unaSesion(true);
    expect(await comun({})).toMatchObject({
      ok: false,
      code: "ACCOUNT_CLOSURE_PENDING",
      message: expect.stringContaining("retirá el pedido"),
    });
  });

  test("las que se declaran con `evenWithPendingClosure` siguen andando", async () => {
    sesion.actual = unaSesion(true);
    expect(await permitida({})).toEqual({ ok: true, data: "hecho" });
    expect(await permitidaAntes({})).toEqual({ ok: true, data: "hecho" });
  });

  test("las acciones públicas no se tocan", async () => {
    sesion.actual = unaSesion(true);
    expect(await publica({})).toEqual({ ok: true, data: "hecho" });
  });
});

describe("con la baja ya ejecutada (F7.9)", () => {
  test("ni siquiera las declaradas con `evenWithPendingClosure`", async () => {
    sesion.actual = unaSesion(true, true);

    // Con la baja PEDIDA la excepción existe para retirar el pedido;
    // ejecutada, la cuenta ya no está.
    expect(await comun({})).toMatchObject({
      ok: false,
      code: "ACCOUNT_CLOSED",
    });
    expect(await permitida({})).toMatchObject({
      ok: false,
      code: "ACCOUNT_CLOSED",
    });
  });

  test("un perfil sin la columna leída no es una cuenta dada de baja", async () => {
    const sinLaColumna = unaSesion(false) as {
      profile: { closedAt?: Date | null };
    };
    delete sinLaColumna.profile.closedAt;
    sesion.actual = sinLaColumna;

    // Se inclina hacia dejar pasar: con `!== null`, un `undefined` dejaría a
    // toda la tienda afuera de su cuenta.
    expect(await comun({})).toEqual({ ok: true, data: "hecho" });
  });
});
