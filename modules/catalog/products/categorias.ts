// Sin `server-only` a propósito: el buscador filtra en el navegador y la
// página filtra igual en el servidor cuando se llega con `?q=`.

import { normalizar } from "@/lib/texto";

export type CategoriaDeLaPagina = {
  id: string;
  slug: string;
  nombre: string;
  /** Productos activos, con o sin stock: lo que muestra el catálogo (RN-05). */
  cantidad: number;
  destacada: boolean;
  /** 200px, para la tarjeta en fila. */
  miniaturaUrl: string | null;
  /** 600px, para la cuadrada de «Destacadas». */
  imagenUrl: string | null;
};

export function cantidadDeProductos(cantidad: number): string {
  return cantidad === 1 ? "1 producto" : `${cantidad} productos`;
}

export type CategoriasRepartidas = {
  /** Destacadas con productos. Vacía mientras se busca: estarían dos veces. */
  destacadas: CategoriaDeLaPagina[];
  /** Todas las que coinciden, destacadas incluidas. */
  conProductos: CategoriaDeLaPagina[];
  total: number;
  buscando: boolean;
};

/**
 * Reparte las categorías en las dos secciones de DR §7.6, conservando el orden
 * de la base. `topeDeDestacadas` es el de los chips de la home.
 */
export function repartirCategorias(
  categorias: CategoriaDeLaPagina[],
  busqueda: string,
  topeDeDestacadas: number,
): CategoriasRepartidas {
  const buscado = normalizar(busqueda);
  const coinciden = buscado
    ? categorias.filter((c) => normalizar(c.nombre).includes(buscado))
    : categorias;

  // La consulta ya trae solo las que tienen productos; el filtro queda por
  // si alguna llega en cero, que llevaría a un catálogo vacío.
  const conProductos = coinciden.filter((c) => c.cantidad > 0);

  return {
    destacadas: buscado
      ? []
      : conProductos.filter((c) => c.destacada).slice(0, topeDeDestacadas),
    conProductos,
    total: conProductos.length,
    buscando: buscado !== "",
  };
}
