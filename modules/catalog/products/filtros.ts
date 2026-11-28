// No es `server-only`: la consulta lee los filtros de la URL y la barra los
// escribe, con los mismos nombres y valores.

import {
  pageParam as leerPagina,
  paramText,
  oneOf,
  type SearchParamsRecord,
} from "@/lib/url-filters";

export type { SearchParamsRecord };

export const ORDENES = [
  // El que queda cuando no hay nada en la URL.
  { valor: "destacados", etiqueta: "Destacados primero" },
  { valor: "nombre", etiqueta: "Nombre" },
  { valor: "precio", etiqueta: "Precio" },
  { valor: "stock", etiqueta: "Stock disponible" },
  { valor: "fecha", etiqueta: "Fecha de carga" },
] as const;

export type OrdenDeProductos = (typeof ORDENES)[number]["valor"];

/** Las solapas. El tablero enlaza a `?estado=…`: no renombrar el parámetro. */
export const ESTADOS = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
] as const;

export type EstadoDeProductos = (typeof ESTADOS)[number]["valor"];

export const FILTROS_DE_STOCK = [
  { valor: "todos", etiqueta: "Cualquier stock" },
  { valor: "sin", etiqueta: "Sin stock" },
  // Sin stock más lo que está por debajo del umbral. El tablero enlaza acá.
  { valor: "reponer", etiqueta: "Para reponer" },
] as const;

export type FiltroDeStock = (typeof FILTROS_DE_STOCK)[number]["valor"];

export type Direccion = "asc" | "desc";

export type FiltrosDeProductos = {
  q: string;
  /** `""` = todas. */
  categoria: string;
  /** `""` = todas. */
  marca: string;
  estado: EstadoDeProductos;
  stock: FiltroDeStock;
  orden: OrdenDeProductos;
  dir: Direccion;
  pagina: number;
};

/** Hacia dónde ordena cada criterio cuando la URL no lo dice. */
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

export const POR_PAGINA = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nunca falla: un valor que no reconoce queda en el de siempre. Los UUID se
 * validan antes de la consulta: `?marca=hola` haría fallar a Postgres.
 */
export function leerFiltros(params: SearchParamsRecord): FiltrosDeProductos {
  const orden = oneOf(params.orden, ORDENES, FILTROS_VACIOS.orden);
  const categoria = paramText(params.categoria);
  const marca = paramText(params.marca);
  const dir = paramText(params.dir);

  return {
    q: paramText(params.q),
    categoria: UUID.test(categoria) ? categoria : "",
    marca: UUID.test(marca) ? marca : "",
    estado: oneOf(params.estado, ESTADOS, FILTROS_VACIOS.estado),
    stock: oneOf(params.stock, FILTROS_DE_STOCK, FILTROS_VACIOS.stock),
    orden,
    dir: dir === "asc" || dir === "desc" ? dir : DIRECCION_NATURAL[orden],
    pagina: leerPagina(params.pagina),
  };
}

/** Lo que coincide con el valor de siempre no se escribe. */
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
 * Si ya es el orden vigente, lo invierte; si no, arranca por su dirección
 * natural. Vuelve a la primera página.
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

/** Búsqueda o filtros; el orden y la solapa no cuentan. */
export function hayFiltros(filtros: FiltrosDeProductos): boolean {
  return (
    filtros.q !== "" ||
    filtros.categoria !== "" ||
    filtros.marca !== "" ||
    filtros.stock !== "todos"
  );
}

/** Conserva el orden y la solapa. */
export function sinFiltros(filtros: FiltrosDeProductos): FiltrosDeProductos {
  return {
    ...FILTROS_VACIOS,
    estado: filtros.estado,
    orden: filtros.orden,
    dir: filtros.dir,
  };
}
