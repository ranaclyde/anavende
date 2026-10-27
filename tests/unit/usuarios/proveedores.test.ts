import { afterEach, describe, expect, test, vi } from "vitest";

import { proveedoresDisponibles } from "@/modules/users/proveedores";

/**
 * F1.7 — Qué botones de ingreso social se muestran.
 *
 * El primero va contra el GoTrue del stack local, que no tiene ninguno
 * prendido: es la prueba de que la dirección, la clave y la forma de la
 * respuesta son las de verdad. Los demás reemplazan `fetch`, porque prender
 * Google en el stack local pediría credenciales reales.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function responde(cuerpo: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(cuerpo, { status })),
  );
}

describe("proveedoresDisponibles", () => {
  test("el GoTrue local contesta y no tiene ninguno prendido", async () => {
    // Sin esto pasaría igual con GoTrue caído: los dos casos dan `[]`.
    const error = vi.spyOn(console, "error");
    expect(await proveedoresDisponibles()).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });

  test("devuelve solo los prendidos, en el orden de los botones", async () => {
    responde({
      external: { facebook: true, github: true, google: true, email: true },
    });
    expect(await proveedoresDisponibles()).toEqual(["google", "facebook"]);
  });

  test("Google prendido y Facebook apagado: solo Google", async () => {
    responde({ external: { google: true, facebook: false } });
    expect(await proveedoresDisponibles()).toEqual(["google"]);
  });

  test("si GoTrue responde con error, ninguno", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    responde({ msg: "Invalid API key" }, 401);
    expect(await proveedoresDisponibles()).toEqual([]);
  });

  test("si GoTrue no contesta, ninguno", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect(await proveedoresDisponibles()).toEqual([]);
  });
});
