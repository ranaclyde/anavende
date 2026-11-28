/**
 * La misma regla que el catálogo aplica en la base con
 * `immutable_unaccent(lower(…))`.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
