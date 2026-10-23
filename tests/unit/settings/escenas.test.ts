import { describe, expect, test } from "vitest";

import { escenaDeHoy, TODAS_PERMITIDAS } from "@/lib/escenas";

/**
 * F9.5 — RF-38. Cuándo se enciende cada escena por fecha.
 *
 * Las horas van en UTC a propósito: la fecha que cuenta es la de Argentina
 * (UTC−3), y los bordes son justo donde las dos no coinciden.
 */

const en = (iso: string) => escenaDeHoy(TODAS_PERMITIDAS, new Date(iso));

describe("escenaDeHoy", () => {
  test("Halloween: del 1 de octubre al 1 de noviembre, los dos incluidos", () => {
    expect(en("2026-09-30T12:00:00Z")).toBeNull();
    expect(en("2026-10-01T12:00:00Z")).toBe("halloween");
    expect(en("2026-10-31T12:00:00Z")).toBe("halloween");
    expect(en("2026-11-01T12:00:00Z")).toBe("halloween");
    expect(en("2026-11-02T12:00:00Z")).toBeNull();
  });

  test("Navidad: del 1 de diciembre al 7 de enero, cruzando el año", () => {
    expect(en("2026-11-30T12:00:00Z")).toBeNull();
    expect(en("2026-12-01T12:00:00Z")).toBe("navidad");
    expect(en("2026-12-31T12:00:00Z")).toBe("navidad");
    expect(en("2027-01-07T12:00:00Z")).toBe("navidad");
    expect(en("2027-01-08T12:00:00Z")).toBeNull();
  });

  test("cuenta la fecha de Argentina, no la del servidor en UTC", () => {
    // 30/11 a las 22:00 en Argentina: en UTC ya es 1 de diciembre.
    expect(en("2026-12-01T01:00:00Z")).toBeNull();
    // 1/12 a las 00:30 en Argentina.
    expect(en("2026-12-01T03:30:00Z")).toBe("navidad");
    // 1/11 a las 23:30 en Argentina: todavía es Halloween.
    expect(en("2026-11-02T02:30:00Z")).toBe("halloween");
  });

  test("apagada desde el panel, no se enciende aunque sea su fecha", () => {
    const sinHalloween = { ...TODAS_PERMITIDAS, halloween: false };
    expect(
      escenaDeHoy(sinHalloween, new Date("2026-10-31T12:00:00Z")),
    ).toBeNull();
    expect(escenaDeHoy(sinHalloween, new Date("2026-12-24T12:00:00Z"))).toBe(
      "navidad",
    );
  });
});
