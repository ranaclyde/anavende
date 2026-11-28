import { SolapasDelPanel } from "@/components/admin/solapas";
import type { EstadoOrden } from "@/modules/orders/estados";
import {
  SOLAPAS,
  urlDeFiltros,
  type FiltrosDeOrdenes,
} from "@/modules/orders/filtros-panel";

/** El conteo es del total, no del filtro puesto (DR §6.9). */
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
