// Sin `server-only`: el período vive en la URL, la consulta lo lee y la barra
// lo escribe. Las fechas son días de acá (`AAAA-MM-DD`, extremos incluidos); el
// corte a instantes lo hace la consulta con `AT TIME ZONE`.

import { TIME_ZONE } from "@/lib/dates";
import { dateParam, oneOf, type SearchParamsRecord } from "@/lib/url-filters";

export type { SearchParamsRecord };

export const ATAJOS = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "7-dias", etiqueta: "Últimos 7 días" },
  { valor: "este-mes", etiqueta: "Este mes" },
  { valor: "mes-anterior", etiqueta: "Mes anterior" },
] as const;

export type Atajo = (typeof ATAJOS)[number]["valor"] | "personalizado";

/** Lo mismo que cuenta el inicio del panel, para que coincida el número. */
export const ATAJO_DE_FABRICA = "este-mes" satisfies Atajo;

export const RANKINGS = [
  { valor: "ingresos", etiqueta: "Por ingresos" },
  { valor: "unidades", etiqueta: "Por unidades" },
] as const;

export type Ranking = (typeof RANKINGS)[number]["valor"];

export type Rango = { desde: string; hasta: string };

export type Periodo = Rango & {
  atajo: Atajo;
  anterior: Rango;
  /** El gráfico va por día hasta 62 días, y por mes más allá. */
  agrupado: "dia" | "mes";
  ranking: Ranking;
};

const DIAS_POR_DIA = 62;

/** `en-CA` es la que escribe `AAAA-MM-DD`. */
const HOY = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hoyEnLaZona(ahora: Date = new Date()): string {
  return HOY.format(ahora);
}

// Los días se cuentan en UTC a propósito: en UTC ningún día dura 23 horas.

function aFecha(dia: string): Date {
  return new Date(`${dia}T00:00:00Z`);
}

function aDia(f: Date): string {
  return f.toISOString().slice(0, 10);
}

export function sumarDias(dia: string, n: number): string {
  const f = aFecha(dia);
  f.setUTCDate(f.getUTCDate() + n);
  return aDia(f);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (aFecha(hasta).getTime() - aFecha(desde).getTime()) / 864e5,
  );
}

function ultimoDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
}

/** El mismo día `n` meses antes o después, recortado al último si no existe. */
function sumarMeses(dia: string, n: number, alUltimo = false): string {
  const f = aFecha(dia);
  const anio = f.getUTCFullYear();
  const mes = f.getUTCMonth() + n;
  const ultimo = ultimoDelMes(anio, mes);
  const d = alUltimo ? ultimo : Math.min(f.getUTCDate(), ultimo);
  return aDia(new Date(Date.UTC(anio, mes, d)));
}

function esUltimoDelMes(dia: string): boolean {
  const f = aFecha(dia);
  return f.getUTCDate() === ultimoDelMes(f.getUTCFullYear(), f.getUTCMonth());
}

function primeroDelMes(dia: string): string {
  return `${dia.slice(0, 8)}01`;
}

/**
 * Si arranca el 1°, mes contra mes (septiembre entero contra agosto entero);
 * si no, contra los mismos días inmediatamente antes.
 */
export function periodoAnterior({ desde, hasta }: Rango): Rango {
  if (desde.endsWith("-01")) {
    const a = aFecha(desde);
    const b = aFecha(hasta);
    const meses =
      (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
      (b.getUTCMonth() - a.getUTCMonth()) +
      1;
    return {
      desde: sumarMeses(desde, -meses),
      hasta: sumarMeses(hasta, -meses, esUltimoDelMes(hasta)),
    };
  }

  const largo = diasEntre(desde, hasta) + 1;
  return { desde: sumarDias(desde, -largo), hasta: sumarDias(desde, -1) };
}

export function rangoDelAtajo(
  atajo: Exclude<Atajo, "personalizado">,
  hoy: string,
): Rango {
  switch (atajo) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "7-dias":
      // Hoy y los seis anteriores.
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "este-mes":
      return { desde: primeroDelMes(hoy), hasta: hoy };
    case "mes-anterior": {
      const desde = sumarMeses(primeroDelMes(hoy), -1);
      return { desde, hasta: sumarMeses(desde, 0, true) };
    }
  }
}

/** Entero y no hasta hoy: el gráfico del inicio dibuja vacíos los que faltan. */
export function elMesEntero(hoy: string): Rango {
  const desde = primeroDelMes(hoy);
  return { desde, hasta: sumarMeses(desde, 0, true) };
}

/**
 * No falla nunca. Con fechas, el atajo se ignora; con una sola, la otra se
 * completa, y dadas vuelta se enderezan.
 */
export function leerPeriodo(
  params: SearchParamsRecord,
  hoy: string = hoyEnLaZona(),
): Periodo {
  const ranking = oneOf(params.ranking, RANKINGS, "ingresos");
  let desde = dateParam(params.desde);
  let hasta = dateParam(params.hasta);

  let atajo: Atajo;
  if (desde || hasta) {
    atajo = "personalizado";
    if (!hasta) hasta = desde > hoy ? desde : hoy;
    if (!desde) desde = hasta;
    if (desde > hasta) [desde, hasta] = [hasta, desde];
  } else {
    atajo = oneOf(params.periodo, ATAJOS, ATAJO_DE_FABRICA);
    ({ desde, hasta } = rangoDelAtajo(atajo, hoy));
  }

  return {
    atajo,
    desde,
    hasta,
    anterior: periodoAnterior({ desde, hasta }),
    agrupado: diasEntre(desde, hasta) + 1 <= DIAS_POR_DIA ? "dia" : "mes",
    ranking,
  };
}

/** Lo que coincide con lo de fábrica no se escribe. */
export function urlDePeriodo(
  cambios:
    | { atajo: Exclude<Atajo, "personalizado">; ranking?: Ranking }
    | { desde: string; hasta: string; ranking?: Ranking },
  base = "/admin/reportes",
): string {
  const params = new URLSearchParams();
  if ("atajo" in cambios) {
    if (cambios.atajo !== ATAJO_DE_FABRICA)
      params.set("periodo", cambios.atajo);
  } else {
    params.set("desde", cambios.desde);
    params.set("hasta", cambios.hasta);
  }
  if (cambios.ranking && cambios.ranking !== "ingresos") {
    params.set("ranking", cambios.ranking);
  }

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

export function urlConRanking(
  periodo: Periodo,
  ranking: Ranking,
  base?: string,
): string {
  return periodo.atajo === "personalizado"
    ? urlDePeriodo(
        { desde: periodo.desde, hasta: periodo.hasta, ranking },
        base,
      )
    : urlDePeriodo({ atajo: periodo.atajo, ranking }, base);
}

/** Con la misma función que la página, para que exporte lo que se ve. */
export function urlDeExportacion(periodo: Periodo): string {
  return urlConRanking(periodo, periodo.ranking, "/admin/reportes/export");
}
