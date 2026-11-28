import "server-only";

import ExcelJS from "exceljs";

import { dateWithTime } from "@/lib/dates";
import {
  toSpreadsheetNumber,
  percentOf,
  sum,
  percentChange,
  type Money,
} from "@/lib/money";
import type { Periodo, Rango } from "@/modules/reports/periodo";
import type {
  FilaAgrupada,
  PorOrigen,
  ProductoVendido,
  PuntoDeVentas,
  Totales,
} from "@/modules/reports/queries";

// Los números van como números y el formato es de la celda (`numFmt`): un
// texto «$ 12.500,00» no se suma ni se filtra. Las fechas van a la medianoche
// UTC: Excel no tiene zonas, y así el día se lee igual en cualquier máquina.

export type DatosDeLaPlanilla = {
  periodo: Periodo;
  totales: Totales;
  anteriores: Totales;
  serie: PuntoDeVentas[];
  /** Todos, no solo los diez de la pantalla. */
  productos: ProductoVendido[];
  categorias: FilaAgrupada[];
  marcas: FilaAgrupada[];
  origenes: PorOrigen[];
  /** Se pasa para poder probarlo. */
  generada: Date;
};

/** Los negativos con signo, no entre paréntesis. */
const MONEDA = '"$" #,##0.00;-"$" #,##0.00';
const ENTERO = "#,##0";
const PORCENTAJE = "0%";
const DIA = "dd/mm/yyyy";
const MES = "mmmm yyyy";

const NOMBRE_DEL_ORIGEN = { web: "Web", manual: "Carga manual" } as const;

export function nombreDelArchivo({ desde, hasta }: Rango): string {
  return desde === hasta
    ? `reportes-de-ventas-${desde}.xlsx`
    : `reportes-de-ventas-${desde}-a-${hasta}.xlsx`;
}

function aFecha(dia: string): Date {
  return new Date(`${dia}T00:00:00Z`);
}

const DIA_LARGO = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function nombreDelRango({ desde, hasta }: Rango): string {
  return desde === hasta
    ? DIA_LARGO.format(aFecha(desde))
    : DIA_LARGO.formatRange(aFecha(desde), aFecha(hasta));
}

/** Anchos a mano: ExcelJS no los calcula, y un monto angosto sale «########». */
function hojaConTabla(
  libro: ExcelJS.Workbook,
  nombre: string,
  columnas: { titulo: string; ancho: number; formato?: string }[],
  filas: (string | number | Date | null)[][],
): ExcelJS.Worksheet {
  const hoja = libro.addWorksheet(nombre, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  hoja.columns = columnas.map((c) => ({
    header: c.titulo,
    width: c.ancho,
    style: c.formato ? { numFmt: c.formato } : {},
  }));

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true };
  encabezado.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F4F5" },
  };

  hoja.addRows(filas);

  if (filas.length > 0) {
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columnas.length },
    };
  }

  return hoja;
}

/** Como fracción, para el formato `0%`. */
function cambio(actual: number, anterior: number): number | null {
  return anterior > 0 ? (actual - anterior) / anterior : null;
}

function cambioDeMonto(actual: Money, anterior: Money): number | null {
  const v = percentChange(actual, anterior);
  return v === null ? null : v / 100;
}

export async function armarPlanilla(datos: DatosDeLaPlanilla): Promise<Buffer> {
  const { periodo, totales, anteriores } = datos;
  const libro = new ExcelJS.Workbook();
  libro.creator = "AnaVende";
  libro.created = datos.generada;

  // La primera hoja dice qué período es: quien lo abre después no tiene la URL.
  const totalesHoja = libro.addWorksheet("Totales");
  totalesHoja.columns = [
    { width: 26 },
    { width: 20 },
    { width: 20 },
    { width: 14 },
  ];
  totalesHoja.addRows([
    ["Reportes de ventas — AnaVende"],
    [`Período: del ${nombreDelRango(periodo)}`],
    [`Comparado con: el ${nombreDelRango(periodo.anterior)}`],
    [`Generado el ${dateWithTime(datos.generada.toISOString())}`],
    [
      "Órdenes finalizadas, menos lo devuelto. Las devoluciones restan el día en que se registran.",
    ],
    [],
  ]);
  totalesHoja.getRow(1).font = { bold: true, size: 14 };

  const filaDeTitulos = totalesHoja.addRow([
    "Indicador",
    "Período",
    "Período anterior",
    "Cambio",
  ]);
  filaDeTitulos.font = { bold: true };
  filaDeTitulos.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F4F5" },
  };

  const conTicket = totales.ordenes > 0 && anteriores.ordenes > 0;
  const indicadores: [string, number, number, number | null, string][] = [
    [
      "Vendido",
      toSpreadsheetNumber(totales.vendido),
      toSpreadsheetNumber(anteriores.vendido),
      cambioDeMonto(totales.vendido, anteriores.vendido),
      MONEDA,
    ],
    [
      "Devoluciones restadas",
      toSpreadsheetNumber(totales.devuelto),
      toSpreadsheetNumber(anteriores.devuelto),
      null,
      MONEDA,
    ],
    [
      "Órdenes finalizadas",
      totales.ordenes,
      anteriores.ordenes,
      cambio(totales.ordenes, anteriores.ordenes),
      ENTERO,
    ],
    [
      "Unidades vendidas",
      totales.unidades,
      anteriores.unidades,
      cambio(totales.unidades, anteriores.unidades),
      ENTERO,
    ],
    [
      "Ticket promedio",
      toSpreadsheetNumber(totales.ticket),
      toSpreadsheetNumber(anteriores.ticket),
      conTicket ? cambioDeMonto(totales.ticket, anteriores.ticket) : null,
      MONEDA,
    ],
  ];
  for (const [nombre, actual, anterior, delta, formato] of indicadores) {
    const fila = totalesHoja.addRow([nombre, actual, anterior, delta]);
    fila.getCell(2).numFmt = formato;
    fila.getCell(3).numFmt = formato;
    fila.getCell(4).numFmt = PORCENTAJE;
  }

  const porDia = periodo.agrupado === "dia";
  hojaConTabla(
    libro,
    porDia ? "Ventas por día" : "Ventas por mes",
    [
      {
        titulo: porDia ? "Día" : "Mes",
        ancho: 16,
        formato: porDia ? DIA : MES,
      },
      { titulo: "Vendido", ancho: 18, formato: MONEDA },
      { titulo: "Órdenes finalizadas", ancho: 20, formato: ENTERO },
    ],
    datos.serie.map((p) => [
      aFecha(p.fecha),
      toSpreadsheetNumber(p.vendido),
      p.ordenes,
    ]),
  );

  // El desglose por color va en su propia hoja, para poder filtrarlo.
  hojaConTabla(
    libro,
    "Más vendidos",
    [
      { titulo: "Puesto", ancho: 8, formato: ENTERO },
      { titulo: "Producto", ancho: 40 },
      { titulo: "Marca", ancho: 18 },
      { titulo: "Unidades", ancho: 12, formato: ENTERO },
      { titulo: "Vendido", ancho: 18, formato: MONEDA },
    ],
    datos.productos.map((p, i) => [
      i + 1,
      p.nombre,
      p.marca,
      p.unidades,
      toSpreadsheetNumber(p.vendido),
    ]),
  );

  hojaConTabla(
    libro,
    "Por color",
    [
      { titulo: "Producto", ancho: 40 },
      { titulo: "Marca", ancho: 18 },
      { titulo: "Color", ancho: 16 },
      { titulo: "Unidades", ancho: 12, formato: ENTERO },
      { titulo: "Vendido", ancho: 18, formato: MONEDA },
    ],
    datos.productos.flatMap((p) =>
      p.colores.map((c) => [
        p.nombre,
        p.marca,
        c.color ?? "Sin color",
        c.unidades,
        toSpreadsheetNumber(c.vendido),
      ]),
    ),
  );

  for (const [nombre, columna, filas] of [
    ["Por categoría", "Categoría", datos.categorias],
    ["Por marca", "Marca", datos.marcas],
  ] as const) {
    hojaConTabla(
      libro,
      nombre,
      [
        { titulo: columna, ancho: 26 },
        { titulo: "Unidades", ancho: 12, formato: ENTERO },
        { titulo: "Vendido", ancho: 18, formato: MONEDA },
      ],
      filas.map((f) => [f.nombre, f.unidades, toSpreadsheetNumber(f.vendido)]),
    );
  }

  // `sum` es la suma exacta de `lib/money`.
  const total = sum(datos.origenes.map((o) => o.vendido));
  hojaConTabla(
    libro,
    "Web y carga manual",
    [
      { titulo: "Origen", ancho: 16 },
      { titulo: "Vendido", ancho: 18, formato: MONEDA },
      { titulo: "Órdenes finalizadas", ancho: 20, formato: ENTERO },
      { titulo: "Parte de lo vendido", ancho: 20, formato: PORCENTAJE },
    ],
    datos.origenes.map((o) => {
      const parte = percentOf(o.vendido, total);
      return [
        NOMBRE_DEL_ORIGEN[o.origen],
        toSpreadsheetNumber(o.vendido),
        o.ordenes,
        parte === null ? null : parte / 100,
      ];
    }),
  );

  return Buffer.from(await libro.xlsx.writeBuffer());
}
