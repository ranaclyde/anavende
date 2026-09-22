import { SolapasDelPanel } from "@/components/admin/solapas";
import type { EstadoOrden } from "@/modules/orders/estados";
import {
  SOLAPAS,
  urlDeFiltros,
  type FiltrosDeOrdenes,
} from "@/modules/orders/filtros-panel";

/**
 * Las solapas por estado de las órdenes — RF-21, DR §5.2 y §6.9. Tarea F7.1.
 *
 * La forma la pone `SolapasDelPanel`; acá queda lo único propio de órdenes:
 * de dónde sale el número de cada una y a qué dirección lleva.
 *
 * **El conteo es del total y no del filtro puesto**: si cambiara con cada
 * búsqueda, la solapa dejaría de ser un indicador para pasar a ser un
 * resultado más (§6.9).
 *
 * Cambiar de solapa **conserva los filtros y vuelve a la página 1**: la
 * página 3 de las activas no tiene por qué existir entre las canceladas.
 */
export function SolapasDeEstado({
  filtros,
  conteo,
}: {
  filtros: FiltrosDeOrdenes;
  conteo: Record<EstadoOrden, number>;
}) {
  const total = conteo.activa + conteo.finalizada + conteo.cancelada;

  return (
    <SolapasDelPanel
      etiqueta="Filtrar por estado"
      variante="segmentado"
      nombraElConteo={(n) => (n === 1 ? "1 orden" : `${n} órdenes`)}
      solapas={SOLAPAS.map(({ valor, etiqueta, estado }) => ({
        href: urlDeFiltros({ ...filtros, solapa: valor, pagina: 1 }),
        etiqueta,
        activa: filtros.solapa === valor,
        cuantos: estado === null ? total : conteo[estado],
      }))}
    />
  );
}
