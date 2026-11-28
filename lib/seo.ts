import { getSiteUrl } from "@/lib/env";

// Sin `server-only`: lo usan `sitemap.ts` y `robots.ts`.

export const SITE_NAME = "AnaVende";

/**
 * RN-10, la frase de los metadatos. Las de las pantallas son otras y no se
 * unifican.
 */
export const DELIVERY_AREA =
  "Entrega en Viedma, Carmen de Patagones y alrededores.";

/**
 * Una meta description de hasta 155 caracteres (lo que muestra Google), cortada
 * en una palabra.
 */
export function metaDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  // -1: lugar para el «…».
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

/**
 * Para JSON-LD y el mapa del sitio; los metadatos de Next ya usan
 * `metadataBase`.
 */
export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Se esparce en cada `openGraph`: el de una pantalla reemplaza el del layout
 * entero, no se mezcla. `es_AR` con guion bajo es el formato de Open Graph.
 */
export const OPEN_GRAPH_BASE = {
  // `as const` solo acá: sobre el objeto dejaría `images` como `readonly`,
  // que el tipo de Next no acepta.
  type: "website" as const,
  siteName: SITE_NAME,
  locale: "es_AR",
  // Acá y no en `app/opengraph-image.png`: esa se pierde en toda pantalla
  // que declare su propio `openGraph`.
  images: [{ url: "/marca/og.png", width: 1200, height: 630, alt: SITE_NAME }],
};

/**
 * Estas páginas no van además en `robots.txt`: un `Disallow` impide entrar, no
 * indexar, y el buscador nunca leería esta etiqueta.
 */
export const NO_INDEX = { index: false, follow: false } as const;
