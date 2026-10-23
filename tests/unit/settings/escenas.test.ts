import { describe, expect, test } from "vitest";

import {
  domingoDePascua,
  escenaDeHoy,
  periodoEscrito,
  TODAS_PERMITIDAS,
} from "@/lib/escenas";

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

  test("Pascua: la Semana Santa, del Domingo de Ramos al de Pascua, que se mueve cada año", () => {
    // 2027: Pascua el 28 de marzo, Ramos el 21.
    expect(en("2027-03-20T15:00:00Z")).toBeNull();
    expect(en("2027-03-21T15:00:00Z")).toBe("pascua");
    expect(en("2027-03-28T15:00:00Z")).toBe("pascua");
    expect(en("2027-03-29T15:00:00Z")).toBeNull();
    // 2028: Pascua el 16 de abril, Ramos el 9.
    expect(en("2028-04-08T15:00:00Z")).toBeNull();
    expect(en("2028-04-09T15:00:00Z")).toBe("pascua");
    expect(en("2028-04-16T15:00:00Z")).toBe("pascua");
    // Ramos en un mes y Pascua en el otro: 2029, del 25 de marzo al 1 de abril.
    expect(en("2029-03-25T15:00:00Z")).toBe("pascua");
    expect(en("2029-04-01T15:00:00Z")).toBe("pascua");
    expect(en("2029-04-02T15:00:00Z")).toBeNull();
  });
});

describe("domingoDePascua", () => {
  test("coincide con el calendario, incluidos los extremos de marzo y abril", () => {
    const fechas: [number, number, number][] = [
      [2008, 3, 23],
      [2011, 4, 24],
      [2019, 4, 21],
      [2024, 3, 31],
      [2025, 4, 20],
      [2026, 4, 5],
      [2027, 3, 28],
      [2038, 4, 25],
      [2285, 3, 22],
    ];
    for (const [anio, mes, dia] of fechas) {
      expect(domingoDePascua(anio), String(anio)).toEqual({ mes, dia });
    }
  });
});

describe("periodoEscrito", () => {
  test("las fijas, sin año", () => {
    expect(periodoEscrito("navidad")).toBe("Del 1 de diciembre al 7 de enero.");
  });

  test("Pascua con su año: la de este, y si ya pasó, la del que viene", () => {
    expect(periodoEscrito("pascua", new Date("2027-02-10T15:00:00Z"))).toBe(
      "Semana Santa: del 21 al 28 de marzo de 2027.",
    );
    expect(periodoEscrito("pascua", new Date("2026-10-23T15:00:00Z"))).toBe(
      "Semana Santa: del 21 al 28 de marzo de 2027.",
    );
    expect(periodoEscrito("pascua", new Date("2028-01-05T15:00:00Z"))).toBe(
      "Semana Santa: del 9 al 16 de abril de 2028.",
    );
    expect(periodoEscrito("pascua", new Date("2029-01-05T15:00:00Z"))).toBe(
      "Semana Santa: del 25 de marzo al 1 de abril de 2029.",
    );
  });
});
