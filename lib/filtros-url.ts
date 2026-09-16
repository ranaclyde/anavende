/**
 * Leer filtros de la URL sin fallar nunca — §10.2.
 *
 * El estado de los listados del panel vive en la dirección: se comparte,
 * funciona el botón atrás y otra pantalla puede enlazar a una vista concreta.
 * Eso significa que la URL la escribe cualquiera —a mano, o un enlace viejo
 * de hace seis meses—, así que **lo que no se reconoce se descarta y queda el
 * valor de siempre**. Un listado que devuelve un error porque alguien borró
 * media palabra del enlace es un callejón sin salida.
 *
 * **No es `server-only`**: la consulta lee estos valores y la barra de filtros
 * los escribe. Con una copia de cada lado, el día que una cambie la otra deja
 * de encontrar y no lo dice.
 *
 * Vive en `lib/` y no en un módulo porque **lo usan los dos listados** —el de
 * órdenes (F7.1) y el de devoluciones (F7.5)—, y el tercero va a querer las
 * mismas tres reglas.
 */

/** Lo que Next entrega tras hacerle `await` a `searchParams` (§10.2). */
export type ParametrosDeBusqueda = Record<
  string,
  string | string[] | undefined
>;

export function texto(valor: string | string[] | undefined): string {
  // Un parámetro repetido —`?q=a&q=b`— llega como arreglo. Se toma el primero
  // en vez de fallar: la URL la escribe cualquiera, no solo la barra.
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

/** El valor, si es uno de los de la lista; si no, el de siempre. */
export function unaDe<T extends string>(
  valor: string | string[] | undefined,
  opciones: readonly { valor: T }[],
  porDefecto: T,
): T {
  const v = texto(valor);
  return opciones.some((o) => o.valor === v) ? (v as T) : porDefecto;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Una fecha del calendario, o `""`.
 *
 * Se valida la **forma y el valor**: `2026-02-31` tiene forma de fecha y no
 * existe, y entraría a Postgres para hacerlo fallar.
 */
export function fecha(valor: string | string[] | undefined): string {
  const v = texto(valor);
  if (!FECHA.test(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v
    ? ""
    : v;
}

/** Una página: entera y de uno para arriba, o la primera. */
export function pagina(valor: string | string[] | undefined): number {
  const n = Number.parseInt(texto(valor), 10);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
