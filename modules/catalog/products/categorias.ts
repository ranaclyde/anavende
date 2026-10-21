/**
 * La página de categorías, la parte que corre en los dos lados — RF-35,
 * DR §7.6. Tarea F3.10.
 *
 * Sin `server-only` a propósito: el buscador filtra en el navegador (son
 * decenas de categorías, no hace falta ir a la base) y la página filtra igual
 * en el servidor cuando se llega con `?q=`, para que lo primero que se pinta
 * ya sea el resultado y no la lista entera que después se achica.
 */

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

/**
 * Sin acentos y sin mayúsculas: «AURICULARES», «aurícu» y «auriculares»
 * tienen que encontrar lo mismo. Es la misma regla que el catálogo aplica en
 * la base con `immutable_unaccent(lower(…))`, escrita para el navegador.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** «1 producto», «14 productos». */
export function cantidadDeProductos(cantidad: number): string {
  return cantidad === 1 ? "1 producto" : `${cantidad} productos`;
}

export type CategoriasRepartidas = {
  /** Destacadas con productos. Vacía mientras se busca: estarían dos veces. */
  destacadas: CategoriaDeLaPagina[];
  /** Todas las que tienen productos, destacadas incluidas. */
  conProductos: CategoriaDeLaPagina[];
  /** Las que no tienen ninguno, para el final. */
  sinProductos: CategoriaDeLaPagina[];
  /** Cuántas coinciden en total, para el «3 categorías» que se anuncia. */
  total: number;
  /** `true` si hay texto escrito. */
  buscando: boolean;
};

/**
 * Reparte las categorías en las tres secciones de §7.6, ya filtradas por lo
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

  const conProductos = coinciden.filter((c) => c.cantidad > 0);

  return {
    destacadas: buscado
      ? []
      : conProductos.filter((c) => c.destacada).slice(0, topeDeDestacadas),
    conProductos,
    sinProductos: coinciden.filter((c) => c.cantidad === 0),
    total: coinciden.length,
    buscando: buscado !== "",
  };
}
