/**
 * Lo que la libreta de direcciones comparte entre el servidor y el
 * formulario — RF-09, F5.3.
 *
 * Vive aparte de `schemas.ts` para que el formulario, que corre en el
 * navegador, no se lleve zod en el paquete solo para tener la lista de
 * provincias.
 */

/**
 * Hasta 3 direcciones por comprador: la predeterminada y dos más para elegir
 * otra en el checkout (decisión del 2026-09-13, RF-09).
 */
export const MAXIMO_DE_DIRECCIONES = 3;

/**
 * Las 24 jurisdicciones, por orden alfabético. Es una lista cerrada y no un
 * texto libre: «Rio Negro», «Río Negro» y «RN» son la misma provincia, y la
 * vendedora no tendría por qué adivinarlo. El `<select>` nativo deja escribir
 * para buscar, así que el orden alfabético alcanza.
 */
export const PROVINCIAS = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Ciudad Autónoma de Buenos Aires",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export type Provincia = (typeof PROVINCIAS)[number];
