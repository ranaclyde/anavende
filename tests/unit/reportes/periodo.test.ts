import { describe, expect, test } from "vitest";

import {
  hoyEnLaZona,
  leerPeriodo,
  periodoAnterior,
  urlConRanking,
  urlDeExportacion,
  urlDePeriodo,
} from "@/modules/reports/periodo";

/**
 * F9.1 — el período de los reportes y su anterior equivalente. RF-28.
 *
 * Sin base: son cuentas de calendario, y «hoy» se pasa a mano para que el
 * test no dependa del día en que corre.
 */

const HOY = "2026-10-15";

describe("los atajos de RF-28", () => {
  test("sin nada en la URL es este mes, hasta hoy", () => {
    const p = leerPeriodo({}, HOY);
    expect(p).toMatchObject({
      atajo: "este-mes",
      desde: "2026-10-01",
      hasta: "2026-10-15",
      agrupado: "dia",
      ranking: "ingresos",
    });
  });

  test("hoy, últimos 7 días y mes anterior", () => {
    expect(leerPeriodo({ periodo: "hoy" }, HOY)).toMatchObject({
      desde: HOY,
      hasta: HOY,
    });
    // Siete días con hoy adentro.
    expect(leerPeriodo({ periodo: "7-dias" }, HOY)).toMatchObject({
      desde: "2026-10-09",
      hasta: HOY,
    });
    expect(leerPeriodo({ periodo: "mes-anterior" }, HOY)).toMatchObject({
      desde: "2026-09-01",
      hasta: "2026-09-30",
    });
  });

  test("el mes anterior en enero es diciembre del año anterior", () => {
    expect(
      leerPeriodo({ periodo: "mes-anterior" }, "2027-01-10"),
    ).toMatchObject({ desde: "2026-12-01", hasta: "2026-12-31" });
  });

  test("un atajo que no existe vuelve a este mes", () => {
    expect(leerPeriodo({ periodo: "ayer" }, HOY).atajo).toBe("este-mes");
  });
});

describe("el rango personalizado", () => {
  test("con fechas es personalizado, aunque traiga un atajo", () => {
    const p = leerPeriodo(
      { periodo: "hoy", desde: "2026-08-03", hasta: "2026-08-20" },
      HOY,
    );
    expect(p).toMatchObject({
      atajo: "personalizado",
      desde: "2026-08-03",
      hasta: "2026-08-20",
    });
  });

  test("dado vuelta se endereza", () => {
    expect(
      leerPeriodo({ desde: "2026-08-20", hasta: "2026-08-03" }, HOY),
    ).toMatchObject({ desde: "2026-08-03", hasta: "2026-08-20" });
  });

  test("con una sola fecha, la otra se completa", () => {
    // Sin «hasta», es hasta hoy; sin «desde», es ese único día.
    expect(leerPeriodo({ desde: "2026-10-01" }, HOY)).toMatchObject({
      desde: "2026-10-01",
      hasta: HOY,
    });
    expect(leerPeriodo({ hasta: "2026-10-03" }, HOY)).toMatchObject({
      desde: "2026-10-03",
      hasta: "2026-10-03",
    });
  });

  test("una fecha que no existe se descarta", () => {
    expect(leerPeriodo({ desde: "2026-02-31" }, HOY).atajo).toBe("este-mes");
  });

  test("más de 62 días se agrupa por mes", () => {
    expect(
      leerPeriodo({ desde: "2026-01-01", hasta: "2026-03-03" }, HOY).agrupado,
    ).toBe("dia");
    expect(
      leerPeriodo({ desde: "2026-01-01", hasta: "2026-03-04" }, HOY).agrupado,
    ).toBe("mes");
  });
});

describe("el período anterior equivalente", () => {
  test("este mes va contra los mismos días del mes pasado", () => {
    expect(
      periodoAnterior({ desde: "2026-10-01", hasta: "2026-10-15" }),
    ).toEqual({ desde: "2026-09-01", hasta: "2026-09-15" });
  });

  test("un mes entero va contra el mes entero anterior, aunque sea más corto", () => {
    expect(
      periodoAnterior({ desde: "2026-03-01", hasta: "2026-03-31" }),
    ).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(
      periodoAnterior({ desde: "2026-09-01", hasta: "2026-09-30" }),
    ).toEqual({ desde: "2026-08-01", hasta: "2026-08-31" });
  });

  test("el 31 de un mes contra uno de 30 se recorta al 30", () => {
    expect(
      periodoAnterior({ desde: "2026-10-01", hasta: "2026-10-31" }),
    ).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(
      periodoAnterior({ desde: "2026-05-01", hasta: "2026-05-30" }),
    ).toEqual({ desde: "2026-04-01", hasta: "2026-04-30" });
  });

  test("varios meses enteros van contra la misma cantidad antes", () => {
    expect(
      periodoAnterior({ desde: "2026-04-01", hasta: "2026-06-30" }),
    ).toEqual({ desde: "2026-01-01", hasta: "2026-03-31" });
  });

  test("cualquier otro rango va contra los mismos días justo antes", () => {
    expect(
      periodoAnterior({ desde: "2026-10-15", hasta: "2026-10-15" }),
    ).toEqual({ desde: "2026-10-14", hasta: "2026-10-14" });
    expect(
      periodoAnterior({ desde: "2026-10-09", hasta: "2026-10-15" }),
    ).toEqual({ desde: "2026-10-02", hasta: "2026-10-08" });
    // Cruzando un cambio de mes y de año.
    expect(
      periodoAnterior({ desde: "2027-01-03", hasta: "2027-01-05" }),
    ).toEqual({ desde: "2026-12-31", hasta: "2027-01-02" });
  });
});

describe("la URL", () => {
  test("lo de fábrica no se escribe", () => {
    expect(urlDePeriodo({ atajo: "este-mes" })).toBe("/admin/reportes");
    expect(urlDePeriodo({ atajo: "hoy" })).toBe("/admin/reportes?periodo=hoy");
    expect(urlDePeriodo({ desde: "2026-08-03", hasta: "2026-08-20" })).toBe(
      "/admin/reportes?desde=2026-08-03&hasta=2026-08-20",
    );
  });

  test("cambiar el ranking conserva el período", () => {
    const p = leerPeriodo({ desde: "2026-08-03", hasta: "2026-08-20" }, HOY);
    expect(urlConRanking(p, "unidades")).toBe(
      "/admin/reportes?desde=2026-08-03&hasta=2026-08-20&ranking=unidades",
    );
    expect(urlConRanking(leerPeriodo({}, HOY), "unidades")).toBe(
      "/admin/reportes?ranking=unidades",
    );
  });

  test("la exportación lleva el mismo período y ranking que la pantalla (F9.2)", () => {
    expect(urlDeExportacion(leerPeriodo({}, HOY))).toBe(
      "/admin/reportes/export",
    );
    expect(
      urlDeExportacion(
        leerPeriodo(
          { desde: "2026-08-03", hasta: "2026-08-20", ranking: "unidades" },
          HOY,
        ),
      ),
    ).toBe(
      "/admin/reportes/export?desde=2026-08-03&hasta=2026-08-20&ranking=unidades",
    );
    expect(urlDeExportacion(leerPeriodo({ periodo: "hoy" }, HOY))).toBe(
      "/admin/reportes/export?periodo=hoy",
    );
  });

  test("ida y vuelta: lo que escribe la URL es lo que se lee", () => {
    const p = leerPeriodo({ periodo: "7-dias", ranking: "unidades" }, HOY);
    const url = new URL(urlConRanking(p, p.ranking), "http://x");
    expect(leerPeriodo(Object.fromEntries(url.searchParams), HOY)).toEqual(p);
  });
});

test("hoy es el de acá, no el del servidor", () => {
  // 01:30 del 16 en UTC son las 22:30 del 15 en Argentina.
  expect(hoyEnLaZona(new Date("2026-10-16T01:30:00Z"))).toBe("2026-10-15");
});
