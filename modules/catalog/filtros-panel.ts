/**
 * Paginación de las cuatro pantallas de Catálogo — §6.9, §10.2. 2026-09-18.
 *
 * Marcas, categorías, colores y medios de pago no tienen búsqueda ni filtros:
 * lo único que ponen en la URL es la página. Aun así va en la dirección y no
 * en estado de cliente, por §10.2 —se comparte, funciona el botón atrás— y
 * porque `PaginacionDelPanel` dibuja enlaces y necesita un `href`.
 *
 * **No es `server-only`**: la consulta lee la página y la pantalla escribe los
 * enlaces, igual que en los otros cuatro listados del panel.
 *
 * **Con 40 por página estas cuatro no van a paginar por un buen rato** —hoy
 * tienen entre 3 y 4 filas—, y es a propósito: `PaginacionDelPanel` devuelve
 * `null` cuando hay una sola página, así que no se dibuja nada hasta que haga
 * falta. Lo que se gana ahora es que la consulta tenga tope: un listado del
 * panel sin `LIMIT` es una pantalla que crece sin techo.
 */

import {
  pagina as leerPagina,
  type ParametrosDeBusqueda,
} from "@/lib/filtros-url";

export type { ParametrosDeBusqueda };

/** El mismo tope que los otros listados del panel: filas de 44px (§6.9). */
export const POR_PAGINA = 40;

export function leerPaginaDeCatalogo(params: ParametrosDeBusqueda): number {
  return leerPagina(params.pagina);
}

/**
 * La URL de una página. La primera no se escribe: el listado sin tocar es
 * `/admin/catalogo/marcas` a secas.
 */
export function urlDePagina(base: string, pagina: number): string {
  return pagina > 1 ? `${base}?pagina=${pagina}` : base;
}

/** Cuántas páginas hay para ese total. Nunca menos de una. */
export function cuantasPaginas(total: number): number {
  return Math.max(1, Math.ceil(total / POR_PAGINA));
}
