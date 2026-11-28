/**
 * Qué números se dibujan; `null` es un «…». Con más de 7 páginas, siempre 7
 * lugares: la barra no cambia de ancho y «Siguiente» no se corre bajo el dedo.
 */
export function paginasALaVista(
  pagina: number,
  paginas: number,
): (number | null)[] {
  const LUGARES = 7;
  if (paginas <= LUGARES) {
    return Array.from({ length: paginas }, (_, i) => i + 1);
  }
  if (pagina <= 4) return [1, 2, 3, 4, 5, null, paginas];
  if (pagina >= paginas - 3) {
    return [1, null, ...Array.from({ length: 5 }, (_, i) => paginas - 4 + i)];
  }
  return [1, null, pagina - 1, pagina, pagina + 1, null, paginas];
}

/** «12 productos», o con más de una página «Del 41 al 80 de 95 órdenes». */
export function tramo({
  pagina,
  porPagina,
  total,
  cosa,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  cosa: { singular: string; plural: string };
}): string {
  const nombre = total === 1 ? cosa.singular : cosa.plural;
  if (total <= porPagina) return `${total} ${nombre}`;

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  return `Del ${desde} al ${hasta} de ${total} ${nombre}`;
}
