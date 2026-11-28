import { urlDelSitio } from "@/lib/env";

// Sin `server-only`: lo usan `sitemap.ts` y `robots.ts`.

export const NOMBRE_DEL_SITIO = "AnaVende";

/**
 * RN-10, la frase de los metadatos. Las de las pantallas son otras y no se
 * unifican.
 */
export const ZONA_DE_ENTREGA =
  "Entrega en Viedma, Carmen de Patagones y alrededores.";

/**
 * Una meta description de hasta 155 caracteres (lo que muestra Google), cortada
 * en una palabra.
 */
export function resumenDeMetadatos(texto: string, tope = 155): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= tope) return limpio;

  // -1: lugar para el «…».
  const recorte = limpio.slice(0, tope - 1);
  const espacio = recorte.lastIndexOf(" ");

  return `${(espacio > 0 ? recorte.slice(0, espacio) : recorte).replace(/[\s,.;:—-]+$/, "")}…`;
}

/**
 * Para JSON-LD y el mapa del sitio; los metadatos de Next ya usan
 * `metadataBase`.
 */
export function urlAbsoluta(ruta: string): string {
  return `${urlDelSitio()}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}

/**
 * Se esparce en cada `openGraph`: el de una pantalla reemplaza el del layout
 * entero, no se mezcla. `es_AR` con guion bajo es el formato de Open Graph.
 */
export const OPEN_GRAPH_BASE = {
  // `as const` solo acá: sobre el objeto dejaría `images` como `readonly`,
  // que el tipo de Next no acepta.
  type: "website" as const,
  siteName: NOMBRE_DEL_SITIO,
  locale: "es_AR",
  // Acá y no en `app/opengraph-image.png`: esa se pierde en toda pantalla
  // que declare su propio `openGraph`.
  images: [
    { url: "/marca/og.png", width: 1200, height: 630, alt: NOMBRE_DEL_SITIO },
  ],
};

/**
 * Estas páginas no van además en `robots.txt`: un `Disallow` impide entrar, no
 * indexar, y el buscador nunca leería esta etiqueta.
 */
export const FUERA_DEL_INDICE = { index: false, follow: false } as const;
