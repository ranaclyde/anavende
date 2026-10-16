/**
 * Las cuatro páginas legales — RF-29, F9.3.
 *
 * Son fijas y por eso viven en el código: el pie, el panel y el mapa del
 * sitio necesitan saber cuáles hay sin preguntarle a la base. Lo que se
 * edita desde el panel es el TEXTO de cada una (`legal_pages.content`), no
 * cuáles existen ni cómo se llaman; una quinta página es una decisión de
 * producto, no un renglón que se agrega.
 *
 * No es `server-only`: el pie y las solapas del panel lo importan.
 */

export const PAGINAS_LEGALES = [
  { slug: "como-comprar", titulo: "Cómo comprar" },
  { slug: "garantias", titulo: "Garantías y devoluciones" },
  { slug: "terminos", titulo: "Términos y condiciones" },
  { slug: "privacidad", titulo: "Política de privacidad" },
] as const;

export type SlugLegal = (typeof PAGINAS_LEGALES)[number]["slug"];

export function paginaLegal(slug: string) {
  return PAGINAS_LEGALES.find((p) => p.slug === slug) ?? null;
}
