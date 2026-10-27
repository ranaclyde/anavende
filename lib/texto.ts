/**
 * Sin acentos y sin mayúsculas: «AURICULARES», «aurícu» y «auriculares»
 * tienen que encontrar lo mismo. Es la misma regla que el catálogo aplica en
 * la base con `immutable_unaccent(lower(…))`, escrita para el navegador.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
