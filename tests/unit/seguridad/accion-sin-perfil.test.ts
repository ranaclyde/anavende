import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * Una cuenta sin perfil (entró con Google y no pasó por `/completar-perfil`)
 * no corre la acción, como sin sesión (§13.4, RF-06); pero decirle
 * «Necesitás iniciar sesión» a quien ya inició sesión es falso.
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
