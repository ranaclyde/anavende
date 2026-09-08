import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` combina clases y resuelve los conflictos de Tailwind quedándose con la
 * última. Para hacerlo tiene que saber qué grupo es cada clase, y de los
 * tokens propios de AnaVende no sabe nada: hay que enseñárselos.
 *
 * Sin esta configuración `text-heading` (tamaño) y `text-ink` (color) caen en
 * el mismo grupo y una de las dos se descarta en silencio. Es un fallo que no
 * rompe nada, no avisa, y deja botones con el texto del color equivocado y
 * títulos con el tamaño del párrafo.
 *
 * Solo hacen falta los prefijos AMBIGUOS —los que mapean a más de una
 * propiedad—: `text-` es tamaño o color, `shadow-` es sombra o color de
 * sombra. `bg-`, `border-` y `max-w-` no tienen esa ambigüedad.
 *
 * Al agregar un token a `app/globals.css`, agregarlo también acá.
 */

const COLORES = [
  "brand",
  "brand-hover",
  "brand-active",
  "brand-tint",
  "brand-tint-border",
  "canvas",
  "surface",
  "surface-sunken",
  "ink",
  "ink-secondary",
  "ink-tertiary",
  "ink-inverse",
  "border",
  "border-strong",
  "success",
  "success-tint",
  "warning",
  "warning-tint",
  "danger",
  "danger-tint",
  "info",
  "info-tint",
];

const TAMANOS = [
  "display",
  "title",
  "heading",
  "body-lg",
  "body",
  "body-sm",
  "caption",
];

const RADIOS = [
  "card",
  "image",
  "modal",
  "panel-card",
  "panel-image",
  "panel-control",
  "pill",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TAMANOS }],
      "text-color": [{ text: COLORES }],
      shadow: [{ shadow: ["brand"] }],
      rounded: [{ rounded: RADIOS }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Áreas táctiles de 44px sin cambiar lo que se dibuja — §9, RNF-02.
 *
 * §9 pide **44×44px como mínimo en móvil**, y hay controles que no pueden
 * crecer sin romper la composición: un enlace de texto de 17px de alto, el
 * isotipo de 32px del encabezado, un chip de filtro. Lo que está chico en
 * esos casos **no es el dibujo, es el blanco alrededor**.
 *
 * La solución es un `::after` transparente y posicionado que agranda la zona
 * que responde al dedo sin mover un píxel de lo que se ve. Se agregó primero
 * en la barra de filtros (F3.4) y vive acá desde que el encabezado, el pie y
 * la ficha necesitaron lo mismo.
 *
 * **Dos condiciones para usarlo bien**:
 *
 * 1. Quien lo lleve tiene que ser `relative`, o el `::after` se ancla al
 *    ancestro posicionado que encuentre y se va a cualquier lado.
 * 2. **Hay que mirar la separación con los vecinos.** Lo que sobresale tiene
 *    que caber en ella; si no, dos controles se pisan la zona sensible y el
 *    dedo activa el de al lado. Cuando no entra —una lista de enlaces con 8px
 *    entre filas, por ejemplo— la respuesta no es esto sino darle altura real
 *    a la fila.
 *
 * No se limita a móvil aunque §9 hable de móvil: es invisible, y en
 * escritorio le da margen al mouse impreciso sin costo alguno.
 */
export const AREA_TACTIL =
  "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']";

/**
 * La versión cuadrada, para los controles que están cortos **de los dos
 * lados** —el isotipo de 32px, un ícono suelto—. `AREA_TACTIL` solo estira a
 * lo alto porque lo pensado para chips y enlaces ya es ancho de sobra.
 */
export const AREA_TACTIL_CUADRADA =
  "after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";
