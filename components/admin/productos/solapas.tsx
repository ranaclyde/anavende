import { SolapasDelPanel } from "@/components/admin/solapas";
import {
  ESTADOS,
  urlDeFiltros,
  type EstadoDeProductos,
  type FiltrosDeProductos,
} from "@/modules/catalog/products/filtros";

/**
 * El conteo es del total, no del filtro puesto. Cambiar de solapa conserva
 * búsqueda, filtros y orden, y vuelve a la página 1: la 3 de los activos puede
 * no existir entre los inactivos.
 */
export function SolapasDeEstadoDeProducto({
  filtros,
  conteo,
}: {
  filtros: FiltrosDeProductos;
  conteo: Record<EstadoDeProductos, number>;
}) {
  return (
    <SolapasDelPanel
      etiqueta="Filtrar por estado del producto"
      variante="segmentado"
      nombraElConteo={(n) => (n === 1 ? "1 producto" : `${n} productos`)}
      solapas={ESTADOS.map(({ valor, etiqueta }) => ({
        href: urlDeFiltros({ ...filtros, estado: valor, pagina: 1 }),
        etiqueta,
        activa: filtros.estado === valor,
        cuantos: conteo[valor],
      }))}
    />
  );
}
