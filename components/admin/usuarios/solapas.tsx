import { SolapasDelPanel } from "@/components/admin/solapas";
import {
  ESTADOS,
  urlDeFiltros,
  type FiltroDeEstado,
  type FiltrosDeUsuarios,
} from "@/modules/users/panel/filtros";

/**
 * Las solapas por estado de las cuentas — RF-26, RF-34 · DR §6.9.
 *
 * **Existen desde el 2026-09-21.** §6.9 nombra a órdenes *y a usuarios* como
 * las pantallas que llevan solapas por estado con su número, y acá había un
 * desplegable de cinco opciones sin un solo número: la regla estaba escrita y
 * vencida. El que más importa es «Baja pedida», que es trabajo por hacer
 * (RF-34) y hasta hoy no se veía sin abrir el desplegable.
 *
 * **El conteo es del total y no del filtro puesto**: buscar «ana» no cambia
 * cuántas cuentas hay bloqueadas. Cambiar de solapa conserva la búsqueda y el
 * rol, y vuelve a la página 1.
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
