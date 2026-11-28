// Aparte de `marca-de-agua.ts`, que usa sharp y es solo del servidor: el
// panel necesita estas listas en el navegador.

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

export const MAXIMO_DE_CAPAS = 4;

export type Capa = {
  mode: Modo;
  anchor: Ancla;
  sizePct: number;
  marginPct: number;
  opacityPct: number;
};
