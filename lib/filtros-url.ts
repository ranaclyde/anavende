// Filtros de la URL sin fallar nunca (TECHNICAL-SPEC §10.2): la URL la escribe
// cualquiera, así que lo que no se reconoce queda en el valor de siempre.
// Sin `server-only`: la consulta los lee y la barra de filtros los escribe.

export type ParametrosDeBusqueda = Record<
  string,
  string | string[] | undefined
>;

export function texto(valor: string | string[] | undefined): string {
  // `?q=a&q=b` llega como arreglo: se toma el primero.
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
 * Una fecha del calendario, o `""`. `2026-02-31` tiene la forma pero haría
 * fallar a Postgres.
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
