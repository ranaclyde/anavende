import ExcelJS from "exceljs";
import { describe, expect, test } from "vitest";

import { armarPlanilla, nombreDelArchivo } from "@/modules/reports/excel";
import { leerPeriodo } from "@/modules/reports/periodo";
import type { Totales } from "@/modules/reports/queries";

/**
 * F9.2 — la exportación a Excel. RF-28 · TS §15.
 *
 * Sin base: `armarPlanilla` recibe datos ya leídos, y acá se arma el libro y
 * se vuelve a abrir con ExcelJS para mirar lo que de verdad quedó adentro.
 */

const periodo = leerPeriodo({}, "2026-10-15");

const totales: Totales = {
  vendido: "12500.50",
  devuelto: "1000.00",
  ordenes: 4,
  unidades: 9,
  ticket: "3375.13",
};
const anteriores: Totales = {
  vendido: "10000.00",
  devuelto: "0",
  ordenes: 5,
  unidades: 9,
  ticket: "2000.00",
};

async function abrir() {
  const archivo = await armarPlanilla({
    periodo,
    totales,
    anteriores,
    serie: [
      { fecha: "2026-10-01", vendido: "0", ordenes: 0 },
      { fecha: "2026-10-02", vendido: "12500.50", ordenes: 4 },
    ],
    productos: [
      {
        id: "a",
        nombre: "Auricular Cloud II",
        marca: "HyperX",
        unidades: 7,
        vendido: "9000.00",
        colores: [
          { color: "Negro", unidades: 5, vendido: "6000.00" },
          { color: "Rojo", unidades: 2, vendido: "3000.00" },
        ],
      },
      {
        id: "b",
        nombre: "Cable USB-C",
        marca: "Genérica",
        unidades: 2,
        vendido: "3500.50",
        colores: [{ color: null, unidades: 2, vendido: "3500.50" }],
      },
    ],
    categorias: [
      { id: "c", nombre: "Auriculares", unidades: 7, vendido: "9000.00" },
    ],
    marcas: [{ id: "m", nombre: "HyperX", unidades: 7, vendido: "9000.00" }],
    origenes: [
      { origen: "web", vendido: "2500.50", ordenes: 1 },
      { origen: "manual", vendido: "10000.00", ordenes: 3 },
    ],
    generada: new Date("2026-10-15T15:30:00Z"),
  });

  const libro = new ExcelJS.Workbook();
  // Los tipos de ExcelJS piden un `ArrayBuffer` (su `Buffer` es eso), no el
  // `Buffer` de Node: se le pasa justo el pedazo que ocupa el archivo.
  await libro.xlsx.load(
    archivo.buffer.slice(
      archivo.byteOffset,
      archivo.byteOffset + archivo.byteLength,
    ) as ArrayBuffer,
  );
  return libro;
}

describe("la planilla de reportes (RF-28)", () => {
  test("una hoja por reporte, en el orden de la pantalla", async () => {
    const libro = await abrir();
    expect(libro.worksheets.map((h) => h.name)).toEqual([
      "Totales",
      "Ventas por día",
      "Más vendidos",
      "Por color",
      "Por categoría",
      "Por marca",
      "Web y carga manual",
    ]);
  });

  test("los totales dicen el período y comparan con el anterior", async () => {
    const hoja = (await abrir()).getWorksheet("Totales")!;
    expect(hoja.getCell("A2").value).toBe(
      "Período: del 1–15 de octubre de 2026",
    );
    expect(hoja.getCell("A3").value).toBe(
      "Comparado con: el 1–15 de septiembre de 2026",
    );
    // La hora es la de acá: 15:30 UTC son las 12:30.
    expect(hoja.getCell("A4").value).toBe("Generado el 15/10/2026, 12:30");

    const vendido = hoja.getRow(8);
    expect(vendido.getCell(1).value).toBe("Vendido");
    expect(vendido.getCell(2).value).toBe(12500.5);
    expect(vendido.getCell(2).numFmt).toBe('"$" #,##0.00;-"$" #,##0.00');
    expect(vendido.getCell(4).value).toBe(0.25);
    expect(vendido.getCell(4).numFmt).toBe("0%");

    // Órdenes: de 5 a 4 es −20 %; las unidades no cambiaron.
    expect(hoja.getRow(10).getCell(4).value).toBe(-0.2);
    expect(hoja.getRow(11).getCell(4).value).toBe(0);
  });

  test("los montos y las fechas son números y fechas, no texto", async () => {
    const hoja = (await abrir()).getWorksheet("Ventas por día")!;
    const dia = hoja.getRow(3);
    expect(dia.getCell(1).value).toEqual(new Date("2026-10-02T00:00:00Z"));
    expect(dia.getCell(1).numFmt).toBe("dd/mm/yyyy");
    expect(dia.getCell(2).value).toBe(12500.5);
    expect(dia.getCell(3).value).toBe(4);
  });

  test("más vendidos con puesto, y el desglose por color en su hoja", async () => {
    const libro = await abrir();
    const mas = libro.getWorksheet("Más vendidos")!;
    expect(mas.getRow(2).values).toEqual([
      undefined,
      1,
      "Auricular Cloud II",
      "HyperX",
      7,
      9000,
    ]);

    const colores = libro.getWorksheet("Por color")!;
    expect(
      colores
        .getRows(2, 3)!
        .map((f) => [f.getCell(1).value, f.getCell(3).value]),
    ).toEqual([
      ["Auricular Cloud II", "Negro"],
      ["Auricular Cloud II", "Rojo"],
      ["Cable USB-C", "Sin color"],
    ]);
  });

  test("web y manual con la parte de cada uno", async () => {
    const hoja = (await abrir()).getWorksheet("Web y carga manual")!;
    expect(hoja.getRow(2).values).toEqual([undefined, "Web", 2500.5, 1, 0.2]);
    expect(hoja.getRow(3).values).toEqual([
      undefined,
      "Carga manual",
      10000,
      3,
      0.8,
    ]);
  });

  test("el encabezado de cada tabla queda fijo y con filtro", async () => {
    const hoja = (await abrir()).getWorksheet("Por categoría")!;
    expect(hoja.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(hoja.autoFilter).toBeTruthy();
  });
});

test("el nombre del archivo dice el período", () => {
  expect(nombreDelArchivo({ desde: "2026-10-01", hasta: "2026-10-15" })).toBe(
    "reportes-de-ventas-2026-10-01-a-2026-10-15.xlsx",
  );
  expect(nombreDelArchivo({ desde: "2026-10-15", hasta: "2026-10-15" })).toBe(
    "reportes-de-ventas-2026-10-15.xlsx",
  );
});
