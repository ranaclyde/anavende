import { describe, expect, test } from "vitest";

import { internalRedirectTarget } from "@/lib/redirect-target";

/** Las vueltas solo llevan a la tienda — redirección abierta, §16. */
describe("internalRedirectTarget", () => {
  test.each(["/", "/productos/mouse-g203?color=negro", "/mi-cuenta/compras"])(
    "acepta %s",
    (v) => {
      expect(internalRedirectTarget(v)).toBe(v);
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
    expect(internalRedirectTarget(v)).toBeUndefined();
  });
});
