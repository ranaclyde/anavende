/**
 * La misma regla que el catálogo aplica en la base con
 * `immutable_unaccent(lower(…))`.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
