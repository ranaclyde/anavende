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

/**
 * Las páginas legales (RF-29) son más largas que una descripción: una
 * política de privacidad con lo que se guarda en el navegador ya pasa los
 * 5.000. El tope existe para que un pegado accidental no publique un libro,
 * no para acotar lo que la vendedora tiene que decir.
 */
export const LIMITE_DE_TEXTO_LEGAL = 15000;
