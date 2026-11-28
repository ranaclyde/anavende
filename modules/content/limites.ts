// Aparte de `markdown.ts`, que es `server-only`: el editor también los usa.

/** Caracteres de TEXTO, no de Markdown. */
export const LIMITE_DE_TEXTO = 5000;

/** El contador aparece recién en los últimos 500 caracteres (DR §6.11). */
export const AVISO_DE_LIMITE = 500;

export const LIMITE_DE_TEXTO_LEGAL = 15000;
