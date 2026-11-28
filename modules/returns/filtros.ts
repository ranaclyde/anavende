// No es `server-only`: la consulta lee estos valores y la barra los escribe.

import {
  dateParam,
  pageParam as leerPagina,
  oneOf,
  type SearchParamsRecord,
} from "@/lib/url-filters";

export type { SearchParamsRecord };

/**
 * «Todas» por omisión: una anulada no se borra, y quien la registró por error
 * tiene que poder encontrarla.
 */
export const ESTADOS = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "registradas", etiqueta: "Registradas" },
  { valor: "anuladas", etiqueta: "Anuladas" },
] as const;

export type FiltroDeEstado = (typeof ESTADOS)[number]["valor"];

/** «Con reposición» es la que repone algo, aunque no sea todo. */
export const REPOSICIONES = [
  { valor: "todas", etiqueta: "Repongan o no" },
  { valor: "con", etiqueta: "Con reposición" },
  { valor: "sin", etiqueta: "Sin reposición" },
] as const;

export type FiltroDeReposicion = (typeof REPOSICIONES)[number]["valor"];

export type FiltrosDeDevoluciones = {
  estado: FiltroDeEstado;
  reposicion: FiltroDeReposicion;
  /** `AAAA-MM-DD` o `""`. Es lo que escribe y lee un `<input type="date">`. */
  desde: string;
  hasta: string;
  pagina: number;
};

export const FILTROS_VACIOS: FiltrosDeDevoluciones = {
  estado: "todas",
  reposicion: "todas",
  desde: "",
  hasta: "",
  pagina: 1,
};

export const POR_PAGINA = 40;

/** Las fechas dadas vuelta se enderezan en vez de devolver cero resultados. */
export function leerFiltros(params: SearchParamsRecord): FiltrosDeDevoluciones {
  const desde = dateParam(params.desde);
  const hasta = dateParam(params.hasta);
  const alReves = desde && hasta && desde > hasta;

  return {
    estado: oneOf(params.estado, ESTADOS, FILTROS_VACIOS.estado),
    reposicion: oneOf(
      params.reposicion,
      REPOSICIONES,
      FILTROS_VACIOS.reposicion,
    ),
    desde: alReves ? hasta : desde,
    hasta: alReves ? desde : hasta,
    pagina: leerPagina(params.pagina),
  };
}

/** Lo que coincide con el valor por omisión no se escribe en la URL. */
export function urlDeFiltros(
  filtros: FiltrosDeDevoluciones,
  base = "/admin/devoluciones",
): string {
  const params = new URLSearchParams();
  if (filtros.estado !== "todas") params.set("estado", filtros.estado);
  if (filtros.reposicion !== "todas") {
    params.set("reposicion", filtros.reposicion);
  }
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

export function hayFiltros(filtros: FiltrosDeDevoluciones): boolean {
  return (
    filtros.estado !== "todas" ||
    filtros.reposicion !== "todas" ||
    filtros.desde !== "" ||
    filtros.hasta !== ""
  );
}
