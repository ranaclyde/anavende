/**
 * Los números del texto con formato — RF-15, DESIGN-REFERENCE §6.11.
 *
 * Viven aparte de `markdown.ts` porque ese módulo es `server-only`: el
 * sanitizador no puede cruzar al cliente, pero el editor necesita saber
 * contra qué número cuenta. Duplicarlos sería garantizar que un día digan
 * cosas distintas.
 */

/** Caracteres de TEXTO, no de Markdown. */
export const LIMITE_DE_TEXTO = 5000;

/**
 * El contador aparece recién en los últimos 500 caracteres (§6.11). Antes es
 * ruido: nadie escribe una descripción de producto mirando cuánto le queda.
 */
export const AVISO_DE_LIMITE = 500;
