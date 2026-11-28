// Aparte de `schemas.ts` para que el formulario los use sin arrastrar Zod al
// navegador.

/** Con 0 el aviso no se encendería nunca: «sin stock» ya cubre ese caso. */
export const UMBRAL_MINIMO = 1;

export const UMBRAL_MAXIMO = 100;

export const AYUDA_DEL_UMBRAL =
  `Escribí un número entero del ${UMBRAL_MINIMO} al ${UMBRAL_MAXIMO}: ` +
  "es a partir de cuántas unidades querés el aviso.";

/**
 * Lo que no cumpla la forma no se manda (`Number.parseInt("3,5")` daría 3);
 * el 101 sí, para que el servidor conteste por qué no entra.
 */
export const ENTERO = /^\d{1,3}$/;
