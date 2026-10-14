/**
 * La cookie de «Vistos recientemente» — F8.4, RF-33, TS §11.3.
 *
 * **Cookie y no `localStorage`, decidido el 2026-10-14.** TS §11.3 decía
 * `localStorage`; con una cookie el servidor la lee y el bloque sale con la
 * página —como «Productos similares»—, sin un segundo viaje para pedir las
 * tarjetas, que solo se pueden armar en el servidor. Sigue en el navegador
 * de quien mira y sin sesión, que es lo que pide RF-33.
 *
 * **Guarda solo ids**, del más reciente al más viejo. Nada de precios: el
 * bloque los consulta cada vez, así que siempre son los vigentes.
 *
 * Este archivo lo leen los dos lados —el navegador la escribe al abrir una
 * ficha, el servidor la lee y la borra—, así que no importa nada de servidor.
 */

export const COOKIE_DE_VISTOS = "vistos";

/** RF-33: los últimos diez. */
export const MAXIMO_DE_VISTOS = 10;

/**
 * 90 días. RF-33 no pone plazo; «recientemente» de hace un año ya no lo es, y
 * una visita nueva la renueva.
 */
export const VIDA_DE_VISTOS = 60 * 60 * 24 * 90;

/**
 * El separador es un punto: la coma no es válida en el valor de una cookie
 * (RFC 6265), y un UUID no lleva puntos.
 */
const SEPARADOR = ".";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lo que dice la cookie, sin confiar en ella: la escribe el navegador, y
 * cualquiera puede ponerle cualquier cosa. Se queda con los UUID válidos, sin
 * repetidos y hasta diez.
 */
export function leerIds(valor: string | undefined): string[] {
  if (!valor) return [];
  const ids = valor.split(SEPARADOR).filter((id) => UUID.test(id));
  return [...new Set(ids)].slice(0, MAXIMO_DE_VISTOS);
}

/** El valor nuevo con `id` adelante: si ya estaba, sube al primer lugar. */
export function sumarVisto(valor: string | undefined, id: string): string {
  return [id, ...leerIds(valor).filter((x) => x !== id)]
    .slice(0, MAXIMO_DE_VISTOS)
    .join(SEPARADOR);
}
