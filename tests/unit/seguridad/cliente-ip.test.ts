import { createServerClient } from "@supabase/ssr";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cabecerasParaGoTrue } from "@/lib/supabase/cliente-ip";

/**
 * F10.5 — La IP del comprador viaja a GoTrue con la clave. TS §16;
 * `lib/supabase/cliente-ip.ts`.
 */

const CLAVE = "a".repeat(64);

afterEach(() => vi.unstubAllEnvs());

function pedido(cabeceras: Record<string, string>) {
  return new Headers(cabeceras);
}

describe("cabecerasParaGoTrue", () => {
  test("con la clave y la IP de Cloudflare, manda las dos", () => {
    vi.stubEnv("SUPABASE_CLAVE_CLIENTE_IP", CLAVE);
    expect(
      cabecerasParaGoTrue(pedido({ "cf-connecting-ip": "203.0.113.7" })),
    ).toEqual({
      "X-Anavende-Clave": CLAVE,
      "X-Anavende-Cliente-Ip": "203.0.113.7",
    });
  });

  test("también una IPv6", () => {
    vi.stubEnv("SUPABASE_CLAVE_CLIENTE_IP", CLAVE);
    expect(
      cabecerasParaGoTrue(pedido({ "cf-connecting-ip": "2001:db8::1" })),
    ).toMatchObject({ "X-Anavende-Cliente-Ip": "2001:db8::1" });
  });

  test("sin la clave no manda nada: en desarrollo y en los tests", () => {
    vi.stubEnv("SUPABASE_CLAVE_CLIENTE_IP", "");
    expect(
      cabecerasParaGoTrue(pedido({ "cf-connecting-ip": "203.0.113.7" })),
    ).toEqual({});
  });

  test("sin Cloudflare no manda nada, ni toma X-Forwarded-For", () => {
    vi.stubEnv("SUPABASE_CLAVE_CLIENTE_IP", CLAVE);
    expect(
      cabecerasParaGoTrue(pedido({ "x-forwarded-for": "203.0.113.7" })),
    ).toEqual({});
  });

  test("lo que no tiene forma de IP no se manda", () => {
    vi.stubEnv("SUPABASE_CLAVE_CLIENTE_IP", CLAVE);
    for (const raro of ["1.2.3.4, 5.6.7.8", "<script>", "x".repeat(60)]) {
      expect(cabecerasParaGoTrue(pedido({ "cf-connecting-ip": raro }))).toEqual(
        {},
      );
    }
  });
});

describe("el cliente de Supabase las manda a GoTrue", () => {
  test("en el ingreso y en la renovación de la sesión", async () => {
    const vistas: Headers[] = [];
    const espia: typeof fetch = async (entrada, init) => {
      vistas.push(new Headers(init?.headers));
      void entrada;
      return new Response(JSON.stringify({ error: "x" }), { status: 400 });
    };

    const supabase = createServerClient(
      "https://supabase.ejemplo.test",
      "clave-publica",
      {
        global: {
          headers: {
            "X-Anavende-Clave": CLAVE,
            "X-Anavende-Cliente-Ip": "203.0.113.7",
          },
          fetch: espia,
        },
        cookies: { getAll: () => [], setAll: () => undefined },
      },
    );

    await supabase.auth.signInWithPassword({
      email: "ana@ejemplo.test",
      password: "lo-que-sea",
    });
    await supabase.auth.refreshSession({ refresh_token: "un-token" });

    expect(vistas.length).toBeGreaterThanOrEqual(2);
    for (const h of vistas) {
      expect(h.get("x-anavende-clave")).toBe(CLAVE);
      expect(h.get("x-anavende-cliente-ip")).toBe("203.0.113.7");
    }
  });
});
