import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Sin esto, `twMerge` pone `text-heading` (tamaño) y `text-ink` (color) en el
// mismo grupo y descarta uno en silencio. Solo hacen falta los prefijos
// ambiguos. Al agregar un token a `app/globals.css`, agregarlo también acá.

const COLORS = [
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

const SIZES = [
  "display",
  "title",
  "heading",
  "body-lg",
  "body",
  "body-sm",
  "caption",
];

const RADII = [
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
      "font-size": [{ text: SIZES }],
      "text-color": [{ text: COLORS }],
      shadow: [{ shadow: ["brand"] }],
      rounded: [{ rounded: RADII }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Área táctil de 44px sin cambiar lo que se dibuja (RNF-02). Quien lo lleve
 * tiene que ser `relative`, y lo que sobresale tiene que caber en la
 * separación con los vecinos: si no, el dedo activa el de al lado.
 */
export const TOUCH_AREA =
  "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']";

/**
 * Para los controles cortos de los dos lados; `TOUCH_AREA` solo estira a lo
 * alto.
 */
export const SQUARE_TOUCH_AREA =
  "after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";
