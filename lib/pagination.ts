/**
 * Qué números se dibujan; `null` es un «…». Con más de 7 páginas, siempre 7
 * lugares: la barra no cambia de ancho y «Siguiente» no se corre bajo el dedo.
 */
export function visiblePages(
  page: number,
  pageCount: number,
): (number | null)[] {
  const SLOTS = 7;
  if (pageCount <= SLOTS) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  if (page <= 4) return [1, 2, 3, 4, 5, null, pageCount];
  if (page >= pageCount - 3) {
    return [1, null, ...Array.from({ length: 5 }, (_, i) => pageCount - 4 + i)];
  }
  return [1, null, page - 1, page, page + 1, null, pageCount];
}

/** «12 productos», o con más de una página «Del 41 al 80 de 95 órdenes». */
export function rangeLabel({
  page,
  perPage,
  total,
  noun,
}: {
  page: number;
  perPage: number;
  total: number;
  noun: { singular: string; plural: string };
}): string {
  const label = total === 1 ? noun.singular : noun.plural;
  if (total <= perPage) return `${total} ${label}`;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return `Del ${from} al ${to} de ${total} ${label}`;
}
