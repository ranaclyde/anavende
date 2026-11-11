/**
 * Las formas de una capa de la marca de agua — RF-39, TS §9.6.
 *
 * Aparte de `marca-de-agua.ts` porque esa usa sharp y es solo del servidor,
 * y el panel necesita estas listas en el navegador para dibujar los
 * controles. Un solo lugar para las dos: la grilla de nueve lugares y la
 * restricción de la tabla no pueden decir cosas distintas.
 */

export const MODOS = ["posicion", "cubrir", "estirar", "mosaico"] as const;
export type Modo = (typeof MODOS)[number];

export const ANCLAS = [
  "arriba-izquierda",
  "arriba",
  "arriba-derecha",
  "izquierda",
  "centro",
  "derecha",
  "abajo-izquierda",
  "abajo",
  "abajo-derecha",
] as const;
export type Ancla = (typeof ANCLAS)[number];

/** Hasta cuántas capas se pueden armar (RF-39). */
export const MAXIMO_DE_CAPAS = 4;

export type Capa = {
  mode: Modo;
  anchor: Ancla;
  sizePct: number;
  marginPct: number;
  opacityPct: number;
};
