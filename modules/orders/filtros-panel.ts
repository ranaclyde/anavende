// Sin `server-only`: la consulta lee los filtros de la URL y la barra los escribe.

import {
  dateParam,
  pageParam as leerPagina,
  paramText,
  oneOf,
  type SearchParamsRecord,
} from "@/lib/url-filters";
import type { EstadoOrden } from "@/modules/orders/estados";

export type { SearchParamsRecord };

export const SOLAPAS = [
  { valor: "activas", etiqueta: "Activas", estado: "activa" },
  { valor: "finalizadas", etiqueta: "Finalizadas", estado: "finalizada" },
  { valor: "canceladas", etiqueta: "Canceladas", estado: "cancelada" },
  { valor: "todas", etiqueta: "Todas", estado: null },
] as const satisfies readonly {
  valor: string;
  etiqueta: string;
  estado: EstadoOrden | null;
}[];

export type Solapa = (typeof SOLAPAS)[number]["valor"];

export function estadoDeLaSolapa(solapa: Solapa): EstadoOrden | null {
  return SOLAPAS.find((s) => s.valor === solapa)!.estado;
}

export const ORIGENES = [
  { valor: "todos", etiqueta: "Web y manuales" },
  { valor: "web", etiqueta: "Solo web" },
  { valor: "manual", etiqueta: "Solo manuales" },
] as const;

export type FiltroDeOrigen = (typeof ORIGENES)[number]["valor"];

export type FiltrosDeOrdenes = {
  solapa: Solapa;
  /** Número de orden, nombre o email del comprador. */
  q: string;
  origen: FiltroDeOrigen;
  /** `AAAA-MM-DD` o `""`, como un `<input type="date">`. */
  desde: string;
  hasta: string;
  pagina: number;
};

export const FILTROS_VACIOS: FiltrosDeOrdenes = {
  solapa: "activas",
  q: "",
  origen: "todos",
  desde: "",
  hasta: "",
  pagina: 1,
};

/** Distinto de los 24 de la tienda a propósito: acá son filas de tabla, no tarjetas. */
export const POR_PAGINA = 40;

/**
 * Lee los filtros de la URL sin fallar nunca: lo que no se reconoce queda en
 * el valor de siempre, y un rango de fechas dado vuelta se endereza.
 */
export function leerFiltros(params: SearchParamsRecord): FiltrosDeOrdenes {
  const desde = dateParam(params.desde);
  const hasta = dateParam(params.hasta);
  const alReves = desde && hasta && desde > hasta;
  const pagina = leerPagina(params.pagina);

  return {
    solapa: oneOf(params.estado, SOLAPAS, FILTROS_VACIOS.solapa),
    q: paramText(params.q),
    origen: oneOf(params.origen, ORIGENES, FILTROS_VACIOS.origen),
    desde: alReves ? hasta : desde,
    hasta: alReves ? desde : hasta,
    pagina,
  };
}

/** Lo que coincide con el valor de siempre no se escribe en la URL. */
export function urlDeFiltros(
  filtros: FiltrosDeOrdenes,
  base = "/admin/ordenes",
): string {
  const params = new URLSearchParams();
  if (filtros.solapa !== "activas") params.set("estado", filtros.solapa);
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.origen !== "todos") params.set("origen", filtros.origen);
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

/** La solapa no cuenta como filtro. */
export function hayFiltros(filtros: FiltrosDeOrdenes): boolean {
  return (
    filtros.q !== "" ||
    filtros.origen !== "todos" ||
    filtros.desde !== "" ||
    filtros.hasta !== ""
  );
}

/** Conserva la solapa. */
export function sinFiltros(filtros: FiltrosDeOrdenes): FiltrosDeOrdenes {
  return { ...FILTROS_VACIOS, solapa: filtros.solapa };
}
