// La cookie de «Vistos recientemente» (TECHNICAL-SPEC §11.3). La leen el
// navegador y el servidor: este archivo no importa nada de servidor.

export const COOKIE_DE_VISTOS = "vistos";

export const MAXIMO_DE_VISTOS = 10;

/** 90 días; una visita nueva la renueva. */
export const VIDA_DE_VISTOS = 60 * 60 * 24 * 90;

/**
 * El separador es un punto: la coma no es válida en el valor de una cookie
 * (RFC 6265), y un UUID no lleva puntos.
 */
const SEPARADOR = ".";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * No confía en la cookie: cualquiera puede escribirle cualquier cosa. Se queda
 * con los UUID válidos, sin repetidos y hasta diez.
 */
export function leerIds(valor: string | undefined): string[] {
  if (!valor) return [];
  const ids = valor.split(SEPARADOR).filter((id) => UUID.test(id));
  return [...new Set(ids)].slice(0, MAXIMO_DE_VISTOS);
}

/** Si `id` ya estaba, sube al primer lugar. */
export function sumarVisto(valor: string | undefined, id: string): string {
  return [id, ...leerIds(valor).filter((x) => x !== id)]
    .slice(0, MAXIMO_DE_VISTOS)
    .join(SEPARADOR);
}
