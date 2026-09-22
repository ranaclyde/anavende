/**
 * Búsqueda, filtros y orden del listado de productos — RF-15, §10.2.
 *
 * Este módulo NO es `server-only` a propósito: el estado del listado vive en
 * la URL (§10.2), así que la consulta tiene que leerlo y la barra de filtros
 * tiene que escribirlo. Si cada lado tuviera su copia de los nombres de los
 * parámetros y de los valores válidos, el día que uno cambie el otro deja de
 * encontrar sin decir nada.
 */

import {
  pagina as leerPagina,
  texto,
  unaDe,
  type ParametrosDeBusqueda,
} from "@/lib/filtros-url";

export type { ParametrosDeBusqueda };

export const ORDENES = [
  // El de siempre, y el que queda cuando no hay nada en la URL: es el orden
  // con el que se venía mostrando el listado desde F2.3.
  { valor: "destacados", etiqueta: "Destacados primero" },
  { valor: "nombre", etiqueta: "Nombre" },
  { valor: "precio", etiqueta: "Precio" },
  { valor: "stock", etiqueta: "Stock disponible" },
  { valor: "fecha", etiqueta: "Fecha de carga" },
] as const;

export type OrdenDeProductos = (typeof ORDENES)[number]["valor"];

/**
 * Las solapas por estado — §6.9. **Son solapas desde el 2026-09-22**, pedido
 * tuyo: productos era el único de los seis listados que escondía su estado en
 * un desplegable, y la pregunta «¿qué tengo sin publicar?» costaba dos clics
 * y no se veía contestada hasta abrirlo.
 *
 * «Todos los estados» perdió el «los estados»: adentro de una lista hacía
 * falta para saber de qué lista era, y como solapa el encabezado ya lo dice.
 *
 * **El parámetro de la URL se sigue llamando `estado`**, que es lo que ya
 * escribían los dos enlaces del tablero (`?estado=activos&stock=reponer` y
 * `?estado=activos`): cambiarle el nombre los habría roto sin avisar.
 */
export const ESTADOS = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
] as const;

export type EstadoDeProductos = (typeof ESTADOS)[number]["valor"];

export const FILTROS_DE_STOCK = [
  { valor: "todos", etiqueta: "Cualquier stock" },
  { valor: "sin", etiqueta: "Sin stock" },
  // «Para reponer» es sin stock MÁS lo que está por debajo del umbral: es una
  // sola pregunta —qué hay que comprar— y por eso es una sola opción. El
  // dashboard de F7.8 enlaza «stock bajo o en cero» a este valor.
  { valor: "reponer", etiqueta: "Para reponer" },
] as const;

export type FiltroDeStock = (typeof FILTROS_DE_STOCK)[number]["valor"];

export type Direccion = "asc" | "desc";

export type FiltrosDeProductos = {
  q: string;
  /** UUID de la categoría, o `""` = todas. */
  categoria: string;
  /** UUID de la marca, o `""` = todas. */
  marca: string;
  estado: EstadoDeProductos;
  stock: FiltroDeStock;
  orden: OrdenDeProductos;
  dir: Direccion;
  pagina: number;
};

/**
 * Hacia dónde ordena cada criterio cuando nadie lo dijo.
 *
 * No son todas iguales porque las preguntas no son iguales: de la fecha
 * interesa lo último que se cargó, y del stock lo que se está por acabar.
 * Poner «ascendente» en las cinco obligaría a invertir a mano justo en los
 * dos casos que más se miran.
 */
export const DIRECCION_NATURAL: Record<OrdenDeProductos, Direccion> = {
  destacados: "desc",
  nombre: "asc",
  precio: "asc",
  stock: "asc",
  fecha: "desc",
};

export const FILTROS_VACIOS: FiltrosDeProductos = {
  q: "",
  categoria: "",
  marca: "",
  estado: "todos",
  stock: "todos",
  orden: "destacados",
  dir: DIRECCION_NATURAL.destacados,
  pagina: 1,
};

/** El mismo tope que los otros listados del panel: filas de 44px (§6.9). */
export const POR_PAGINA = 40;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lee los filtros de la URL sin fallar nunca.
 *
 * Un valor que no reconoce se descarta y queda el de siempre. Es deliberado:
 * la URL es editable a mano y compartible, y un listado que devuelve un
 * error porque alguien borró media palabra del enlace es un callejón sin
 * salida. Los UUID además se validan con forma de UUID **antes** de entrar a
 * la consulta: sin eso, `?marca=hola` no filtraría de menos, haría fallar a
 * Postgres.
 */
export function leerFiltros(
  params: ParametrosDeBusqueda,
): FiltrosDeProductos {
  const orden = unaDe(params.orden, ORDENES, FILTROS_VACIOS.orden);
  const categoria = texto(params.categoria);
  const marca = texto(params.marca);
  const dir = texto(params.dir);

  return {
    q: texto(params.q),
    categoria: UUID.test(categoria) ? categoria : "",
    marca: UUID.test(marca) ? marca : "",
    estado: unaDe(params.estado, ESTADOS, FILTROS_VACIOS.estado),
    stock: unaDe(params.stock, FILTROS_DE_STOCK, FILTROS_VACIOS.stock),
    orden,
    dir: dir === "asc" || dir === "desc" ? dir : DIRECCION_NATURAL[orden],
    pagina: leerPagina(params.pagina),
  };
}

/**
 * La URL que representa estos filtros.
 *
 * Lo que coincide con el valor de siempre NO se escribe: así la dirección de
 * un listado sin tocar es `/admin/productos` a secas, y la de uno filtrado
 * dice exactamente qué se cambió. Una URL con siete parámetros repitiendo
 * los valores por defecto no se puede leer ni comparar de un vistazo.
 */
export function urlDeFiltros(
  filtros: FiltrosDeProductos,
  base = "/admin/productos",
): string {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.categoria) params.set("categoria", filtros.categoria);
  if (filtros.marca) params.set("marca", filtros.marca);
  if (filtros.estado !== "todos") params.set("estado", filtros.estado);
  if (filtros.stock !== "todos") params.set("stock", filtros.stock);
  if (filtros.orden !== "destacados") params.set("orden", filtros.orden);
  if (filtros.dir !== DIRECCION_NATURAL[filtros.orden]) {
    params.set("dir", filtros.dir);
  }
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

/**
 * La URL de ordenar por `orden`: si ya es el orden vigente, lo INVIERTE.
 *
 * Es lo que hace cualquier tabla: el primer clic ordena, el segundo da
 * vuelta. Cambiar de criterio arranca por su dirección natural en vez de
 * heredar la anterior — venir de «más nuevos primero» no tiene por qué
 * dejar los precios de mayor a menor.
 *
 * **Vuelve a la primera página.** Reordenar cambia qué hay en cada página, así
 * que quedarse en la 3 deja a la persona en un lugar que no eligió.
 */
export function urlDeOrden(
  filtros: FiltrosDeProductos,
  orden: OrdenDeProductos,
): string {
  const dir: Direccion =
    filtros.orden === orden
      ? filtros.dir === "asc"
        ? "desc"
        : "asc"
      : DIRECCION_NATURAL[orden];

  return urlDeFiltros({ ...filtros, orden, dir, pagina: 1 });
}

/**
 * Si hay algo que limpiar: búsqueda o filtros, no el orden **ni la solapa**.
 *
 * El estado salió de esta cuenta cuando pasó a ser solapa (2026-09-22), por
 * lo mismo que en órdenes y en usuarios: estar parada en «Inactivos» no es un
 * filtro puesto encima de un listado, es qué listado se está mirando. Si
 * contara, «Limpiar todo» devolvería a otra solapa sin que nadie la tocara.
 */
export function hayFiltros(filtros: FiltrosDeProductos): boolean {
  return (
    filtros.q !== "" ||
    filtros.categoria !== "" ||
    filtros.marca !== "" ||
    filtros.stock !== "todos"
  );
}

/** Limpia la búsqueda y los filtros, y conserva el orden y la solapa. */
export function sinFiltros(filtros: FiltrosDeProductos): FiltrosDeProductos {
  return {
    ...FILTROS_VACIOS,
    estado: filtros.estado,
    orden: filtros.orden,
    dir: filtros.dir,
  };
}
