import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * Las escenas por fecha — F9.5, RF-38 (2026-10-23).
 *
 * En su período, la tienda se viste: el hero de la home cambia de piezas
 * (`components/shop/home/escena-del-hero.ts`) y el logo de la barra lleva un
 * adorno (`components/shop/adorno-de-temporada.tsx`). **Se encienden solas**;
 * lo único que se toca desde el panel es si están permitidas (`site_settings`).
 *
 * **Los períodos están acá, no en la base.** Cada fecha nueva trae sus
 * ilustraciones: no hay forma de sumar una desde el panel sin sumar también
 * los dibujos. Halloween y Navidad caen siempre el mismo día; Pascua se mueve
 * y se calcula para cada año, sin una tabla que alguien tenga que renovar.
 */

export type Escena = "halloween" | "navidad" | "pascua";

/** Mes (1–12) y día, en la hora de Argentina. */
type Dia = { mes: number; dia: number };

type Periodo = { desde: Dia; hasta: Dia };

/**
 * El Domingo de Pascua de un año, con el algoritmo gregoriano anónimo
 * (Meeus/Jones/Butcher): la regla de la Iglesia —el domingo siguiente a la
 * primera luna llena de otoño acá— escrita como aritmética.
 */
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
 * Los dos extremos van INCLUIDOS.
 *
 * - **Halloween**, del 1 de octubre al día después del 31.
 * - **Navidad**, del 1 de diciembre a Reyes, el 7 de enero: cruza el año, y
 *   por eso `desde` es mayor que `hasta`.
 * - **Pascua**, la Semana Santa: del Domingo de Ramos al Domingo de Pascua.
 *   Nunca cruza el año —cae entre el 22 de marzo y el 25 de abril—.
 */
export function periodoDe(escena: Escena, anio: number): Periodo {
  if (escena === "halloween") {
    return { desde: { mes: 10, dia: 1 }, hasta: { mes: 11, dia: 1 } };
  }
  if (escena === "navidad") {
    return { desde: { mes: 12, dia: 1 }, hasta: { mes: 1, dia: 7 } };
  }
  const pascua = domingoDePascua(anio);
  // En UTC solo para restar siete días sin pensar en el largo de cada mes:
  // acá no hay horas, y la zona no cambia la cuenta.
  const ramos = new Date(Date.UTC(anio, pascua.mes - 1, pascua.dia - 7));
  return {
    desde: { mes: ramos.getUTCMonth() + 1, dia: ramos.getUTCDate() },
    hasta: pascua,
  };
}

/** En el orden del año, que es el del panel. */
export const ESCENAS: readonly Escena[] = ["pascua", "halloween", "navidad"];

/** Lo que el panel dejó encendido. */
export type EscenasPermitidas = Record<Escena, boolean>;

/** Sin fila de configuración, todo permitido: lo mismo que el DEFAULT. */
export const TODAS_PERMITIDAS: EscenasPermitidas = {
  pascua: true,
  halloween: true,
  navidad: true,
};

/**
 * **La fecha es la de Argentina, no la del servidor.** El contenedor corre
 * en UTC: sin zona, Navidad arrancaría el 30 de noviembre a las 21.
 */
const FECHA = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: ZONA_HORARIA,
});

/** `1031` para el 31 de octubre: así se comparan con `<=`. */
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

function adentro(hoy: number, { desde, hasta }: Periodo) {
  const d = clave(desde);
  const h = clave(hasta);
  return d <= h ? hoy >= d && hoy <= h : hoy >= d || hoy <= h;
}

/**
 * La escena de hoy, o `null` para la de todos los días: fuera de período o
 * apagada desde el panel. Los períodos no se pisan, así que el orden no
 * decide nada.
 */
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
 * El período escrito, para el panel: «Del 1 de diciembre al 7 de enero.».
 *
 * Pascua lleva el año, porque cambia: se muestra la de este año mientras no
 * haya pasado, y si ya pasó, la del que viene, que es la próxima que se va a
 * ver.
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
