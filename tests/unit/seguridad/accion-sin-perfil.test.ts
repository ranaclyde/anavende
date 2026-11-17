import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * Una cuenta sin perfil que llama a una acción — §13.4, RF-06.
 *
 * Quien entra con Google tiene cuenta desde la vuelta del proveedor, pero
 * perfil recién al pasar por `/completar-perfil`. En ese rato, para el
 * envoltorio sigue siendo falta de autorización (§13.4): la acción no corre.
 * Lo que cambia es **qué se le dice**: «Necesitás iniciar sesión» a quien ya
 * inició sesión es falso, y no le dice qué hacer.
 *
 * No toca la base: lo que se prueba es la decisión del envoltorio, y la
 * sesión y la identidad son las dos respuestas que la alimentan.
 */

const quien = vi.hoisted(() => ({
  sesion: null as unknown,
  identidad: null as unknown,
}));
vi.mock("@/lib/session", () => ({
  getSession: async () => quien.sesion,
  getIdentity: async () => quien.identidad,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

const { action } = await import("@/lib/action");

const corrio = vi.fn();
const deComprador = action.auth("customer").handler(async () => {
  corrio();
  return "hecho";
});

afterEach(() => {
  quien.sesion = null;
  quien.identidad = null;
  corrio.mockReset();
});

describe("una acción de comprador", () => {
  test("sin nadie adentro, pide iniciar sesión", async () => {
    const r = await deComprador(undefined);

    expect(r).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      message: "Necesitás iniciar sesión para hacer eso.",
    });
    expect(corrio).not.toHaveBeenCalled();
  });

  test("con cuenta y sin perfil, pide completar el perfil y no corre", async () => {
    quien.identidad = { userId: "00000000-0000-0000-0000-000000000001" };

    const r = await deComprador(undefined);

    expect(r).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      message: "Te falta completar tu perfil. Completalo y probá de nuevo.",
    });
    expect(corrio).not.toHaveBeenCalled();
  });
});
