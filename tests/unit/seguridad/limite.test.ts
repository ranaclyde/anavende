import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { consume, rateLimitOrThrow, resetRateLimits } from "@/lib/rate-limit";

/**
 * El tope de pedidos por ventana, TS §16. El reloj se pasa a mano: con
 * `Date.now()` el test dependería de cuánto tarda en correr.
 */

const TOPE = { tope: 3, ventanaMs: 60_000 };

beforeEach(() => resetRateLimits());

describe("consume", () => {
  test("deja pasar hasta el tope y frena el siguiente", () => {
    expect(consume("a", TOPE, 0)).toEqual({ allowed: true });
    expect(consume("a", TOPE, 1_000)).toEqual({ allowed: true });
    expect(consume("a", TOPE, 2_000)).toEqual({ allowed: true });
    expect(consume("a", TOPE, 3_000)).toEqual({
      allowed: false,
      // El primero sale de la ventana en 60 s, y ya pasaron 3.
      retryAfterSeconds: 57,
    });
  });

  test("un pedido frenado no ocupa lugar", () => {
    for (const t of [0, 1_000, 2_000]) consume("a", TOPE, t);
    // Diez intentos frenados no corren la espera.
    for (let i = 0; i < 10; i++) consume("a", TOPE, 30_000);
    expect(consume("a", TOPE, 60_001)).toEqual({ allowed: true });
  });

  test("la ventana desliza: libera de a uno, no todo de golpe", () => {
    for (const t of [0, 20_000, 40_000]) consume("a", TOPE, t);
    // A los 60 s sale solo el primero: entra uno y el siguiente se frena.
    expect(consume("a", TOPE, 60_001)).toEqual({ allowed: true });
    expect(consume("a", TOPE, 60_002).allowed).toBe(false);
  });

  test("cada clave cuenta por su lado", () => {
    for (const t of [0, 1, 2]) consume("a", TOPE, t);
    expect(consume("a", TOPE, 3).allowed).toBe(false);
    expect(consume("b", TOPE, 3)).toEqual({ allowed: true });
  });

  test("la espera nunca es menos de un segundo", () => {
    for (const t of [0, 1, 2]) consume("a", TOPE, t);
    expect(consume("a", TOPE, 59_999)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });
});

const pedido = vi.hoisted(() => ({ cabeceras: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => pedido.cabeceras }));

describe("rateLimitOrThrow", () => {
  const CUPO = { tope: 2, ventanaMs: 5 * 60_000 };

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    pedido.cabeceras = new Headers({ "cf-connecting-ip": "203.0.113.7" });
  });
  afterEach(() => vi.unstubAllEnvs());

  test("corta al pasar el cupo, con cuánto esperar y sin hablar del email", async () => {
    await rateLimitOrThrow("ingreso", CUPO);
    await rateLimitOrThrow("ingreso", CUPO);

    const corte = rateLimitOrThrow("ingreso", CUPO);
    await expect(corte).rejects.toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
      message:
        "Probaste muchas veces seguidas. Esperá 5 minutos y probá de nuevo.",
    });
  });

  test("cuenta por persona y por acción", async () => {
    await rateLimitOrThrow("ingreso", CUPO);
    await rateLimitOrThrow("ingreso", CUPO);

    await expect(rateLimitOrThrow("alta", CUPO)).resolves.toBeUndefined();
    pedido.cabeceras = new Headers({ "cf-connecting-ip": "198.51.100.9" });
    await expect(rateLimitOrThrow("ingreso", CUPO)).resolves.toBeUndefined();
  });

  test("sin Cloudflare, la primera IP de X-Forwarded-For", async () => {
    pedido.cabeceras = new Headers({
      "x-forwarded-for": "192.0.2.1, 10.0.0.2",
    });
    await rateLimitOrThrow("ingreso", CUPO);
    await rateLimitOrThrow("ingreso", CUPO);
    await expect(rateLimitOrThrow("ingreso", CUPO)).rejects.toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
    });
  });

  test("fuera de producción no limita", async () => {
    vi.stubEnv("NODE_ENV", "development");
    for (let i = 0; i < 5; i++) {
      await expect(rateLimitOrThrow("ingreso", CUPO)).resolves.toBeUndefined();
    }
  });
});
