// Fijas en el código: desde el panel se edita solo el texto. Sin `server-only`
// porque lo importan el pie y las solapas del panel.

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
