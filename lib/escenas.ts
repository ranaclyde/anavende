import { ZONA_HORARIA } from "@/lib/fechas";

// Las escenas por fecha (RF-38). Los períodos están acá y no en la base:
// cada fecha nueva trae sus ilustraciones, que no se suman desde el panel.

export type Escena = "halloween" | "navidad" | "pascua";

type Dia = { mes: number; dia: number };

type Periodo = { desde: Dia; hasta: Dia };

/** Algoritmo gregoriano anónimo (Meeus/Jones/Butcher). */
export function domingoDePascua(anio: number): Dia {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

/**
 * Los dos extremos van incluidos. Navidad cruza el año: `desde` es mayor que
 * `hasta`.
 */
export function periodoDe(escena: Escena, anio: number): Periodo {
  if (escena === "halloween") {
    return { desde: { mes: 10, dia: 1 }, hasta: { mes: 11, dia: 1 } };
  }
  if (escena === "navidad") {
    return { desde: { mes: 12, dia: 1 }, hasta: { mes: 1, dia: 7 } };
  }
  const pascua = domingoDePascua(anio);
  const ramos = new Date(Date.UTC(anio, pascua.mes - 1, pascua.dia - 7));
  return {
    desde: { mes: ramos.getUTCMonth() + 1, dia: ramos.getUTCDate() },
    hasta: pascua,
  };
}

export const ESCENAS: readonly Escena[] = ["pascua", "halloween", "navidad"];

export type EscenasPermitidas = Record<Escena, boolean>;

/** Sin fila de configuración: lo mismo que el DEFAULT. */
export const TODAS_PERMITIDAS: EscenasPermitidas = {
  pascua: true,
  halloween: true,
  navidad: true,
};

// El contenedor corre en UTC: sin zona, Navidad arrancaría el 30 de noviembre a
// las 21.
const FECHA = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: ZONA_HORARIA,
});

function clave({ mes, dia }: Dia): number {
  return mes * 100 + dia;
}

function hoyEnArgentina(ahora: Date): { anio: number; hoy: number } {
  const partes = FECHA.formatToParts(ahora);
  const valor = (tipo: "year" | "month" | "day") =>
    Number.parseInt(partes.find((p) => p.type === tipo)?.value ?? "", 10);
  return {
    anio: valor("year"),
    hoy: clave({ mes: valor("month"), dia: valor("day") }),
  };
}

/**
 * Hoy en Argentina como número (`20261120`): la semilla del sorteo del hero.
 */
export function diaDeArgentina(ahora: Date = new Date()): number {
  const { anio, hoy } = hoyEnArgentina(ahora);
  return anio * 10000 + hoy;
}

function adentro(hoy: number, { desde, hasta }: Periodo) {
  const d = clave(desde);
  const h = clave(hasta);
  return d <= h ? hoy >= d && hoy <= h : hoy >= d || hoy <= h;
}

/** La escena de hoy, o `null` fuera de período o si está apagada. */
export function escenaDeHoy(
  permitidas: EscenasPermitidas,
  ahora: Date = new Date(),
): Escena | null {
  const { anio, hoy } = hoyEnArgentina(ahora);
  for (const escena of ESCENAS) {
    if (permitidas[escena] && adentro(hoy, periodoDe(escena, anio))) {
      return escena;
    }
  }
  return null;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * «Del 1 de diciembre al 7 de enero.». Pascua lleva el año: la próxima que se
 * va a ver.
 */
export function periodoEscrito(escena: Escena, ahora: Date = new Date()) {
  const { anio, hoy } = hoyEnArgentina(ahora);
  if (escena !== "pascua") {
    const { desde, hasta } = periodoDe(escena, anio);
    return `Del ${desde.dia} de ${MESES[desde.mes - 1]} al ${hasta.dia} de ${MESES[hasta.mes - 1]}.`;
  }
  const cual = hoy <= clave(periodoDe("pascua", anio).hasta) ? anio : anio + 1;
  const { desde, hasta } = periodoDe("pascua", cual);
  const mesDesde = desde.mes === hasta.mes ? "" : ` de ${MESES[desde.mes - 1]}`;
  return `Semana Santa: del ${desde.dia}${mesDesde} al ${hasta.dia} de ${MESES[hasta.mes - 1]} de ${cual}.`;
}
