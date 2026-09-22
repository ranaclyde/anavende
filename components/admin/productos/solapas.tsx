import { SolapasDelPanel } from "@/components/admin/solapas";
import {
  ESTADOS,
  urlDeFiltros,
  type EstadoDeProductos,
  type FiltrosDeProductos,
} from "@/modules/catalog/products/filtros";

/**
 * Las solapas por estado del catálogo — RF-15 · DR §6.9.
 *
 * **Existen desde el 2026-09-22**, pedido tuyo: de los seis listados del
 * panel, productos era el único que tenía su estado adentro de un desplegable.
 * La pregunta que contesta —«¿qué cargué y todavía no publiqué?»— costaba
 * abrir la lista, elegir y recién ahí ver el número.
 *
 * La forma la pone `SolapasDelPanel`; acá queda lo único propio del catálogo:
 * de dónde sale el número de cada una y a qué dirección lleva.
 *
 * **El conteo es del total y no del filtro puesto**: buscar «teclado» no
 * cambia cuántos productos inactivos hay. Cambiar de solapa **conserva la
 * búsqueda, los filtros y el orden, y vuelve a la página 1**: la página 3 de
 * los activos no tiene por qué existir entre los inactivos.
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
