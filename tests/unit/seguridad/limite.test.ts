import { beforeEach, describe, expect, test } from "vitest";

import { consumir, reiniciarLimites } from "@/lib/limite";

/**
 * F10.5 — El tope de pedidos por ventana. TS §16; `lib/limite.ts`.
 *
 * El reloj se pasa a mano: con `Date.now()` el test dependería de cuánto
 * tarda en correr.
 */

const TOPE = { tope: 3, ventanaMs: 60_000 };

beforeEach(() => reiniciarLimites());

describe("consumir", () => {
  test("deja pasar hasta el tope y frena el siguiente", () => {
    expect(consumir("a", TOPE, 0)).toEqual({ permitido: true });
    expect(consumir("a", TOPE, 1_000)).toEqual({ permitido: true });
    expect(consumir("a", TOPE, 2_000)).toEqual({ permitido: true });
    expect(consumir("a", TOPE, 3_000)).toEqual({
      permitido: false,
      // El primero sale de la ventana en 60 s, y ya pasaron 3.
      reintentarEnSegundos: 57,
    });
  });

  test("un pedido frenado no ocupa lugar", () => {
    for (const t of [0, 1_000, 2_000]) consumir("a", TOPE, t);
    // Diez intentos frenados no corren la espera.
    for (let i = 0; i < 10; i++) consumir("a", TOPE, 30_000);
    expect(consumir("a", TOPE, 60_001)).toEqual({ permitido: true });
  });

  test("la ventana desliza: libera de a uno, no todo de golpe", () => {
    for (const t of [0, 20_000, 40_000]) consumir("a", TOPE, t);
    // A los 60 s sale solo el primero: entra uno y el siguiente se frena.
    expect(consumir("a", TOPE, 60_001)).toEqual({ permitido: true });
    expect(consumir("a", TOPE, 60_002).permitido).toBe(false);
  });

  test("cada clave cuenta por su lado", () => {
    for (const t of [0, 1, 2]) consumir("a", TOPE, t);
    expect(consumir("a", TOPE, 3).permitido).toBe(false);
    expect(consumir("b", TOPE, 3)).toEqual({ permitido: true });
  });

  test("la espera nunca es menos de un segundo", () => {
    for (const t of [0, 1, 2]) consumir("a", TOPE, t);
    expect(consumir("a", TOPE, 59_999)).toEqual({
      permitido: false,
      reintentarEnSegundos: 1,
    });
  });
});
