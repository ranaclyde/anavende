/**
 * El `id` del aviso de «cuenta en pausa» del layout de la tienda (F5.8).
 *
 * Vive aparte y no en `cuenta-en-pausa.tsx` porque ése es `"use client"`: un
 * Server Component que importa un valor de un módulo de cliente no recibe el
 * valor, recibe una referencia. El layout lo pone en el aviso, y los
 * controles apagados lo nombran en su `aria-describedby`.
 */
export const ID_AVISO_DE_PAUSA = "aviso-cuenta-en-pausa";
