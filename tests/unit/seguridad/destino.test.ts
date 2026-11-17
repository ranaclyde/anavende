import { describe, expect, test } from "vitest";

import { destinoInterno } from "@/lib/destino";

/** Las vueltas solo llevan a la tienda — redirección abierta, §16. */
describe("destinoInterno", () => {
  test.each(["/", "/productos/mouse-g203?color=negro", "/mi-cuenta/compras"])(
    "acepta %s",
    (v) => {
      expect(destinoInterno(v)).toBe(v);
    },
  );

  test.each([
    ["sin nada", undefined],
    ["vacío", ""],
    ["con protocolo", "https://otro.com"],
    ["sin protocolo", "//otro.com"],
    ["con barra invertida", "/\\otro.com"],
    ["relativo", "productos"],
  ])("rechaza %s", (_, v) => {
    expect(destinoInterno(v)).toBeUndefined();
  });
});
