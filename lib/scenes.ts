import { TIME_ZONE } from "@/lib/dates";

// Las escenas por fecha (RF-38). Los períodos están acá y no en la base:
// cada fecha nueva trae sus ilustraciones, que no se suman desde el panel.

export type Scene = "halloween" | "navidad" | "pascua";

type MonthDay = { month: number; day: number };

type Period = { from: MonthDay; to: MonthDay };

/** Algoritmo gregoriano anónimo (Meeus/Jones/Butcher). */
export function easterSunday(year: number): MonthDay {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Los dos extremos van incluidos. Navidad cruza el año: `from` es mayor que
 * `to`.
 */
export function periodOf(scene: Scene, year: number): Period {
  if (scene === "halloween") {
    return { from: { month: 10, day: 1 }, to: { month: 11, day: 1 } };
  }
  if (scene === "navidad") {
    return { from: { month: 12, day: 1 }, to: { month: 1, day: 7 } };
  }
  const easter = easterSunday(year);
  const palmSunday = new Date(Date.UTC(year, easter.month - 1, easter.day - 7));
  return {
    from: { month: palmSunday.getUTCMonth() + 1, day: palmSunday.getUTCDate() },
    to: easter,
  };
}

export const SCENES: readonly Scene[] = ["pascua", "halloween", "navidad"];

export type AllowedScenes = Record<Scene, boolean>;

/** Sin fila de configuración: lo mismo que el DEFAULT. */
export const ALL_ALLOWED: AllowedScenes = {
  pascua: true,
  halloween: true,
  navidad: true,
};

// El contenedor corre en UTC: sin zona, Navidad arrancaría el 30 de noviembre a
// las 21.
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: TIME_ZONE,
});

function dayKey({ month, day }: MonthDay): number {
  return month * 100 + day;
}

function todayInArgentina(now: Date): { year: number; today: number } {
  const parts = DATE_FORMAT.formatToParts(now);
  const part = (unit: "year" | "month" | "day") =>
    Number.parseInt(parts.find((p) => p.type === unit)?.value ?? "", 10);
  return {
    year: part("year"),
    today: dayKey({ month: part("month"), day: part("day") }),
  };
}

/**
 * Hoy en Argentina como número (`20261120`): la semilla del sorteo del hero.
 */
export function argentinaDayNumber(now: Date = new Date()): number {
  const { year, today } = todayInArgentina(now);
  return year * 10000 + today;
}

function isWithin(today: number, { from, to }: Period) {
  const d = dayKey(from);
  const h = dayKey(to);
  return d <= h ? today >= d && today <= h : today >= d || today <= h;
}

/** La escena de hoy, o `null` fuera de período o si está apagada. */
export function todaysScene(
  allowed: AllowedScenes,
  now: Date = new Date(),
): Scene | null {
  const { year, today } = todayInArgentina(now);
  for (const scene of SCENES) {
    if (allowed[scene] && isWithin(today, periodOf(scene, year))) {
      return scene;
    }
  }
  return null;
}

const MONTHS = [
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
export function periodText(scene: Scene, now: Date = new Date()) {
  const { year, today } = todayInArgentina(now);
  if (scene !== "pascua") {
    const { from, to } = periodOf(scene, year);
    return `Del ${from.day} de ${MONTHS[from.month - 1]} al ${to.day} de ${MONTHS[to.month - 1]}.`;
  }
  const whichYear =
    today <= dayKey(periodOf("pascua", year).to) ? year : year + 1;
  const { from, to } = periodOf("pascua", whichYear);
  const fromMonth =
    from.month === to.month ? "" : ` de ${MONTHS[from.month - 1]}`;
  return `Semana Santa: del ${from.day}${fromMonth} al ${to.day} de ${MONTHS[to.month - 1]} de ${whichYear}.`;
}
