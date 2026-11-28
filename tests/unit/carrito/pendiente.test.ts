import { randomUUID } from "node:crypto";

import { describe, expect, test } from "vitest";

import { interpretar } from "@/modules/cart/pendiente";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";

/**
 * Cómo se lee la compra pendiente que vuelve del navegador (RF-08). La cookie
 * es `httpOnly`, pero una extensión o un cliente escrito a mano pueden mandar
 * cualquier cosa: un valor que no pasa el esquema se ignora en silencio, y la
 * ficha se dibuja con su botón de siempre.
 */
const variantId = randomUUID();

describe("una nota que se puede usar", () => {
  test("vuelve tal como se guardó", () => {
    expect(interpretar(JSON.stringify({ variantId, cantidad: 3 }))).toEqual({
      variantId,
      cantidad: 3,
    });
  });

  test("el tope por renglón entra justo", () => {
    expect(
      interpretar(JSON.stringify({ variantId, cantidad: TOPE_POR_ITEM })),
    ).toEqual({ variantId, cantidad: TOPE_POR_ITEM });
  });
});

describe("una nota que no sirve se ignora", () => {
  test("sin cookie no hay nada pendiente", () => {
    expect(interpretar(undefined)).toBeNull();
    expect(interpretar("")).toBeNull();
  });

  test("lo que no es JSON no rompe la ficha", () => {
    expect(interpretar("{esto no es json")).toBeNull();
    expect(interpretar("null")).toBeNull();
    expect(interpretar("[]")).toBeNull();
  });

  test("un id que no es un uuid no llega a la base", () => {
    expect(
      interpretar(JSON.stringify({ variantId: "1 OR 1=1", cantidad: 1 })),
    ).toBeNull();
  });

  test("una cantidad fuera de rango no se recorta, se descarta", () => {
    // Recortar sería agregar algo distinto de lo que se pidió, sin decirlo.
    for (const cantidad of [0, -5, 1.5, TOPE_POR_ITEM + 1, "2", null]) {
      expect(interpretar(JSON.stringify({ variantId, cantidad }))).toBeNull();
    }
  });

  test("le falta la mitad", () => {
    expect(interpretar(JSON.stringify({ variantId }))).toBeNull();
    expect(interpretar(JSON.stringify({ cantidad: 2 }))).toBeNull();
  });
});
