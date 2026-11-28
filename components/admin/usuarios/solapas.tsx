import { SolapasDelPanel } from "@/components/admin/solapas";
import {
  ESTADOS,
  urlDeFiltros,
  type FiltroDeEstado,
  type FiltrosDeUsuarios,
} from "@/modules/users/panel/filtros";

/**
 * Las solapas por estado de las cuentas — RF-26, RF-34, DR §6.9. El conteo
 * es del total y no del filtro puesto. Cambiar de solapa conserva la búsqueda
 * y el rol, y vuelve a la página 1.
 */
export function SolapasDeEstadoDeCuenta({
  filtros,
  conteo,
}: {
  filtros: FiltrosDeUsuarios;
  conteo: Record<FiltroDeEstado, number>;
}) {
  return (
    <SolapasDelPanel
      etiqueta="Filtrar por estado de la cuenta"
      variante="segmentado"
      nombraElConteo={(n) => (n === 1 ? "1 cuenta" : `${n} cuentas`)}
      solapas={ESTADOS.map(({ valor, etiqueta }) => ({
        href: urlDeFiltros({ ...filtros, estado: valor, pagina: 1 }),
        etiqueta,
        activa: filtros.estado === valor,
        cuantos: conteo[valor],
      }))}
    />
  );
}
