/**
 * Las cuentas de la paginación, sin dibujo: las usan la paginación de
 * `components/ui/paginacion.tsx` y los contadores del panel.
 */

/**
 * Qué números se dibujan (2026-11-05). Con hasta 7 páginas, todas. Con más,
 * la primera, la última y la actual con sus vecinas, y «…» en los saltos:
 * `1 … 4 5 6 … 73`. Sin esto, el panel —las órdenes se acumulan sin techo—
 * terminaría con una tira de cien números, que era el motivo para que tuviera
 * su propia paginación.
 *
 * **Siempre la misma cantidad de lugares** (7) cuando hay más de 7 páginas:
 * cerca de las puntas se muestran más números en vez de un «…», así la barra
 * no cambia de ancho al avanzar y «Siguiente» no se corre bajo el dedo.
 *
 * `null` es un «…».
 */
export function paginasALaVista(
  pagina: number,
  paginas: number,
): (number | null)[] {
  const LUGARES = 7;
  if (paginas <= LUGARES) {
    return Array.from({ length: paginas }, (_, i) => i + 1);
  }
  // Cerca del principio: 1 2 3 4 5 … N
  if (pagina <= 4) return [1, 2, 3, 4, 5, null, paginas];
  // Cerca del final: 1 … N-4 N-3 N-2 N-1 N
  if (pagina >= paginas - 3) {
    return [1, null, ...Array.from({ length: 5 }, (_, i) => paginas - 4 + i)];
  }
  // En el medio: 1 … p-1 p p+1 … N
  return [1, null, pagina - 1, pagina, pagina + 1, null, paginas];
}

/**
 * Lo que dice el contador de arriba de un listado del panel.
 *
 * Con una sola página, cuántos hay: «12 productos». Con más, **qué tramo se
 * está mirando**: «Del 41 al 80 de 95 órdenes». Cuenta filas, que es lo que
 * se ve, y dice si hay más sin mirar abajo: el «al» llega o no al total.
 */
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
