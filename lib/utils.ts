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
