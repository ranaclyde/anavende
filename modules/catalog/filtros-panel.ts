// Paginación de marcas, categorías, colores y medios de pago. No es
// `server-only`: la consulta lee la página y la pantalla escribe los enlaces.

import {
  pagina as leerPagina,
  type ParametrosDeBusqueda,
} from "@/lib/filtros-url";

export type { ParametrosDeBusqueda };

export const POR_PAGINA = 40;

export function leerPaginaDeCatalogo(params: ParametrosDeBusqueda): number {
  return leerPagina(params.pagina);
}

/** La primera página no se escribe en la URL. */
export function urlDePagina(base: string, pagina: number): string {
  return pagina > 1 ? `${base}?pagina=${pagina}` : base;
}

/** Nunca menos de una. */
export function cuantasPaginas(total: number): number {
  return Math.max(1, Math.ceil(total / POR_PAGINA));
}
