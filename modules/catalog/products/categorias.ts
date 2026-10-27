/**
 * La página de categorías, la parte que corre en los dos lados — RF-35,
 * DR §7.6. Tarea F3.10.
 *
 * Sin `server-only` a propósito: el buscador filtra en el navegador (son
 * decenas de categorías, no hace falta ir a la base) y la página filtra igual
 * en el servidor cuando se llega con `?q=`, para que lo primero que se pinta
 * ya sea el resultado y no la lista entera que después se achica.
 */

import { normalizar } from "@/lib/texto";

export type CategoriaDeLaPagina = {
  id: string;
  /** Para el enlace: `?categoria=` va por slug. */
  slug: string;
  nombre: string;
  /** Productos activos, con o sin stock: lo que muestra el catálogo (RN-05). */
  cantidad: number;
  destacada: boolean;
  /** La de 200px, para la tarjeta en fila; `null` si no tiene. */
  miniaturaUrl: string | null;
  /** La de 600px, para la cuadrada de «Destacadas»; `null` si no tiene. */
  imagenUrl: string | null;
};

/** «1 producto», «14 productos». */
export function cantidadDeProductos(cantidad: number): string {
  return cantidad === 1 ? "1 producto" : `${cantidad} productos`;
}

export type CategoriasRepartidas = {
  /** Destacadas con productos. Vacía mientras se busca: estarían dos veces. */
  destacadas: CategoriaDeLaPagina[];
  /** Todas las que coinciden, destacadas incluidas. */
  conProductos: CategoriaDeLaPagina[];
  /** Cuántas coinciden, para el «3 categorías» que se anuncia. */
  total: number;
  /** `true` si hay texto escrito. */
  buscando: boolean;
};

/**
 * Reparte las categorías en las dos secciones de §7.6, ya filtradas por lo
 * escrito. Llegan ordenadas de la base y el orden se conserva: filtrar no
 * reordena.
 *
 * `topeDeDestacadas` es el de la home (siete): las destacadas de arriba son
 * las mismas de los chips, y con más dejan de entrar en una fila.
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
