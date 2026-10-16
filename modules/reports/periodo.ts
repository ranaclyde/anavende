/**
 * El período de los reportes y su período anterior equivalente — FS RF-28.
 * Tarea F9.1.
 *
 * **No es `server-only`**, por lo mismo que los filtros de los listados: el
 * período vive en la URL (§10.2), la consulta lo lee y la barra lo escribe.
 *
 * **Las fechas son días del calendario de acá**, `AAAA-MM-DD`, y los dos
 * extremos se incluyen. El corte a instantes lo hace la consulta con
 * `AT TIME ZONE` (`lib/fechas.ts`): «hoy» en el servidor, que corre en UTC,
 * empieza tres horas tarde.
 */

import { ZONA_HORARIA } from "@/lib/fechas";
import { fecha, unaDe, type ParametrosDeBusqueda } from "@/lib/filtros-url";

export type { ParametrosDeBusqueda };

/**
 * Los atajos de RF-28, en el orden en que se leen: de lo más corto a lo más
 * largo, y «personalizado» al final porque no es un botón sino lo que pasa al
 * tocar las fechas.
 */
export const ATAJOS = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "7-dias", etiqueta: "Últimos 7 días" },
  { valor: "este-mes", etiqueta: "Este mes" },
  { valor: "mes-anterior", etiqueta: "Mes anterior" },
] as const;

export type Atajo = (typeof ATAJOS)[number]["valor"] | "personalizado";

/**
 * **Abre en «Este mes»**, que es lo mismo que cuenta el inicio del panel
 * (F7.8): quien viene de ahí encuentra el mismo número, y desde ahí se ajusta.
 */
export const ATAJO_DE_FABRICA = "este-mes" satisfies Atajo;

/** Ranking de «Más vendidos»: por plata o por unidades (RF-28). */
export const RANKINGS = [
  { valor: "ingresos", etiqueta: "Por ingresos" },
  { valor: "unidades", etiqueta: "Por unidades" },
] as const;

export type Ranking = (typeof RANKINGS)[number]["valor"];

export type Rango = { desde: string; hasta: string };

export type Periodo = Rango & {
  atajo: Atajo;
  /** El período contra el que se comparan los totales. */
  anterior: Rango;
  /**
   * De a cuánto se agrupa el gráfico de ventas. **Hasta 62 días va por día**
   * —dos meses de columnas todavía se leen—; más allá, cien columnas finitas
   * no dicen nada que doce no digan mejor.
   */
  agrupado: "dia" | "mes";
  ranking: Ranking;
};

const DIAS_POR_DIA = 62;

/** Hoy, en la zona del negocio. `en-CA` es la que escribe `AAAA-MM-DD`. */
const HOY = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hoyEnLaZona(ahora: Date = new Date()): string {
  return HOY.format(ahora);
}

// ── Aritmética de días ──────────────────────────────────────────────────
// En UTC a propósito: acá no hay instantes, hay días del calendario, y en UTC
// ningún día dura 23 horas.

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
 * El período anterior equivalente — RF-28.
 *
 * **Si el período arranca el 1°, se compara mes contra mes**: «este mes» al 15
 * de octubre va contra el 1 al 15 de septiembre, y «mes anterior» —septiembre
 * entero— contra agosto entero, aunque tengan 30 y 31 días. Contar 30 días
 * para atrás compararía septiembre con un pedazo de agosto y un día de julio,
 * y nadie piensa así sus ventas.
 *
 * **Cualquier otro rango va contra los mismos días inmediatamente antes**:
 * hoy contra ayer, los últimos 7 contra los 7 previos.
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

/** Las fechas de un atajo, contadas desde `hoy`. */
export function rangoDelAtajo(
  atajo: Exclude<Atajo, "personalizado">,
  hoy: string,
): Rango {
  switch (atajo) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "7-dias":
      // Siete días con hoy adentro: hoy y los seis anteriores.
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "este-mes":
      return { desde: primeroDelMes(hoy), hasta: hoy };
    case "mes-anterior": {
      const desde = sumarMeses(primeroDelMes(hoy), -1);
      return { desde, hasta: sumarMeses(desde, 0, true) };
    }
  }
}

/**
 * El mes de `hoy`, del 1° al último día — el gráfico del inicio del panel
 * (F7.8 con F9.1). Entero y no hasta hoy: los días que faltan se dibujan
 * vacíos, y así se ve cuánto mes queda.
 */
export function elMesEntero(hoy: string): Rango {
  const desde = primeroDelMes(hoy);
  return { desde, hasta: sumarMeses(desde, 0, true) };
}

/**
 * Lee el período de la URL sin fallar nunca.
 *
 * **Con fechas, es personalizado** y el atajo se ignora: las fechas son lo más
 * específico que hay en la dirección. Con una sola, la otra se completa —sin
 * «hasta» es hasta hoy, sin «desde» es ese único día—, y dadas vuelta se
 * enderezan, como en los listados: «del 30 al 1» es evidentemente un rango.
 */
export function leerPeriodo(
  params: ParametrosDeBusqueda,
  hoy: string = hoyEnLaZona(),
): Periodo {
  const ranking = unaDe(params.ranking, RANKINGS, "ingresos");
  let desde = fecha(params.desde);
  let hasta = fecha(params.hasta);

  let atajo: Atajo;
  if (desde || hasta) {
    atajo = "personalizado";
    if (!hasta) hasta = desde > hoy ? desde : hoy;
    if (!desde) desde = hasta;
    if (desde > hasta) [desde, hasta] = [hasta, desde];
  } else {
    atajo = unaDe(params.periodo, ATAJOS, ATAJO_DE_FABRICA);
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

/**
 * La URL que representa este período.
 *
 * Lo que coincide con lo de fábrica no se escribe: `/admin/reportes` a secas
 * es «este mes, por ingresos».
 */
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

/** La URL del mismo período, con otro ranking. */
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

/**
 * La exportación a Excel de lo que está en pantalla — F9.2. **Los mismos
 * parámetros que la página**, escritos por la misma función: así el archivo
 * no puede traer otro período que el que se está mirando (RF-28, «respetando
 * los filtros aplicados»).
 */
export function urlDeExportacion(periodo: Periodo): string {
  return urlConRanking(periodo, periodo.ranking, "/admin/reportes/export");
}
