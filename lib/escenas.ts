import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * Las escenas por fecha — F9.5, RF-38 (2026-10-23).
 *
 * En su período, la tienda se viste: el hero de la home cambia de piezas
 * (`components/shop/home/escena-del-hero.ts`) y el logo de la barra lleva un
 * adorno (`components/shop/adorno-de-temporada.tsx`). **Se encienden solas**;
 * lo único que se toca desde el panel es si están permitidas (`site_settings`).
 *
 * **Los períodos son fijos y están acá, no en la base.** Halloween y Navidad
 * caen siempre el mismo día, y cada fecha nueva trae sus ilustraciones: no hay
 * forma de sumar una desde el panel sin sumar también los dibujos.
 */

export type Escena = "halloween" | "navidad";

/** Mes (1–12) y día, en la hora de Argentina. */
type Dia = { mes: number; dia: number };

/**
 * Los dos extremos van INCLUIDOS. Halloween, del 1 de octubre al día después
 * del 31; Navidad, del 1 de diciembre a Reyes, el 7 de enero, y por eso cruza
 * el año: `desde` es mayor que `hasta`.
 */
export const PERIODOS: Record<Escena, { desde: Dia; hasta: Dia }> = {
  halloween: { desde: { mes: 10, dia: 1 }, hasta: { mes: 11, dia: 1 } },
  navidad: { desde: { mes: 12, dia: 1 }, hasta: { mes: 1, dia: 7 } },
};

/** Lo que el panel dejó encendido. */
export type EscenasPermitidas = Record<Escena, boolean>;

/** Sin fila de configuración, todo permitido: lo mismo que el DEFAULT. */
export const TODAS_PERMITIDAS: EscenasPermitidas = {
  halloween: true,
  navidad: true,
};

/**
 * **La fecha es la de Argentina, no la del servidor.** El contenedor corre
 * en UTC: sin zona, Navidad arrancaría el 30 de noviembre a las 21.
 */
const MES_Y_DIA = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  timeZone: ZONA_HORARIA,
});

/** `1031` para el 31 de octubre: así se comparan con `<=`. */
function clave({ mes, dia }: Dia): number {
  return mes * 100 + dia;
}

function hoyEnArgentina(ahora: Date): number {
  const partes = MES_Y_DIA.formatToParts(ahora);
  const valor = (tipo: "month" | "day") =>
    Number.parseInt(partes.find((p) => p.type === tipo)?.value ?? "", 10);
  return clave({ mes: valor("month"), dia: valor("day") });
}

function adentro(hoy: number, { desde, hasta }: (typeof PERIODOS)[Escena]) {
  const d = clave(desde);
  const h = clave(hasta);
  return d <= h ? hoy >= d && hoy <= h : hoy >= d || hoy <= h;
}

/**
 * La escena de hoy, o `null` para la de todos los días: fuera de período o
 * apagada desde el panel.
 */
export function escenaDeHoy(
  permitidas: EscenasPermitidas,
  ahora: Date = new Date(),
): Escena | null {
  const hoy = hoyEnArgentina(ahora);
  for (const escena of Object.keys(PERIODOS) as Escena[]) {
    if (permitidas[escena] && adentro(hoy, PERIODOS[escena])) return escena;
  }
  return null;
}
