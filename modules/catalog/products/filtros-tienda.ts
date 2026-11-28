// No es `server-only`: la consulta lee la URL y la barra la escribe. Los
// filtros multiselección van repetidos (`?marca=a&marca=b`), no con comas.

export const ORDENES_DE_TIENDA = [
  { valor: "relevancia", etiqueta: "Destacados" },
  { valor: "precio-asc", etiqueta: "Menor precio" },
  { valor: "precio-desc", etiqueta: "Mayor precio" },
  { valor: "nombre", etiqueta: "Nombre (A-Z)" },
  { valor: "novedades", etiqueta: "Más nuevos" },
] as const;

export type OrdenDeTienda = (typeof ORDENES_DE_TIENDA)[number]["valor"];

export type FiltrosDeTienda = {
  /**
   * El slug de `/categorias/[slug]`; `null` en `/productos`. No es un filtro:
   * no va en la query, no tiene chip ni cuenta, y «Limpiar todo» la conserva.
   */
  seccion: string | null;
  q: string;
  /** Slugs. Vacío = todas. */
  categoria: readonly string[];
  /** Slugs. Vacío = todas. */
  marca: readonly string[];
  /** Entra si alguna variante tiene alguno de estos colores (RF-02). */
  color: readonly string[];
  /** Pesos enteros sobre el precio final. `null` = sin tope. */
  precioMin: number | null;
  precioMax: number | null;
  oferta: boolean;
  orden: OrdenDeTienda;
  pagina: number;
};

export const POR_PAGINA = 24;

/** Tope contra una URL con `?marca=` repetido cientos de veces. */
export const MAXIMO_POR_FILTRO = 20;

/** Lo que entra en `numeric(12,2)`. */
const TOPE_DE_PRECIO = 9_999_999_999;

export const FILTROS_DE_TIENDA_VACIOS: FiltrosDeTienda = {
  seccion: null,
  q: "",
  categoria: [],
  marca: [],
  color: [],
  precioMin: null,
  precioMax: null,
  oferta: false,
  orden: "relevancia",
  pagina: 1,
};

export type ParametrosDeBusqueda = Record<
  string,
  string | string[] | undefined
>;

/**
 * Con la forma de `searchParams` de Next: un parámetro repetido llega como
 * lista. `Object.fromEntries(params.entries())` se queda solo con el último.
 */
export function parametrosDeLaDireccion(
  params: URLSearchParams,
): ParametrosDeBusqueda {
  const salida: ParametrosDeBusqueda = {};
  for (const clave of new Set(params.keys())) {
    const valores = params.getAll(clave);
    salida[clave] = valores.length > 1 ? valores : valores[0];
  }
  return salida;
}

/** La forma que produce `slugificar`. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LARGO_DE_SLUG = 60;

function texto(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

/**
 * Los slugs válidos, sin repetidos y con tope. En minúsculas: si no,
 * `?marca=Logitech` quedaría aplicado pero sin chip que lo saque.
 */
function lista(valor: string | string[] | undefined): string[] {
  const crudos =
    valor === undefined ? [] : Array.isArray(valor) ? valor : [valor];
  const vistos = new Set<string>();

  for (const crudo of crudos) {
    const slug = crudo.trim().toLowerCase();
    if (slug.length <= LARGO_DE_SLUG && SLUG.test(slug)) vistos.add(slug);
    if (vistos.size >= MAXIMO_POR_FILTRO) break;
  }

  return [...vistos];
}

/** En pesos enteros: el borde no lleva centavos, la comparación sí. */
function pesos(valor: string | string[] | undefined): number | null {
  const crudo = texto(valor);
  if (crudo === "") return null;

  const n = Number.parseInt(crudo, 10);
  // Sin el tope, `formatMoney` lanza en el chip y rompe la página.
  if (!Number.isSafeInteger(n) || n < 0 || n > TOPE_DE_PRECIO) return null;
  return n;
}

/** Nunca falla: un valor que no reconoce queda en el de siempre. */
export function leerFiltrosDeTienda(
  params: ParametrosDeBusqueda,
  seccion: string | null = null,
): FiltrosDeTienda {
  const orden = texto(params.orden);
  const pagina = Number.parseInt(texto(params.pagina), 10);

  let precioMin = pesos(params.precioMin);
  let precioMax = pesos(params.precioMax);
  // Un rango al revés se da vuelta en vez de descartarse.
  if (precioMin !== null && precioMax !== null && precioMin > precioMax) {
    [precioMin, precioMax] = [precioMax, precioMin];
  }

  return {
    seccion,
    q: texto(params.q),
    // En la página de una categoría, `?categoria=` no se lee.
    categoria: seccion ? [] : lista(params.categoria),
    marca: lista(params.marca),
    color: lista(params.color),
    precioMin,
    precioMax,
    oferta: texto(params.oferta) === "1",
    orden: ORDENES_DE_TIENDA.some((o) => o.valor === orden)
      ? (orden as OrdenDeTienda)
      : FILTROS_DE_TIENDA_VACIOS.orden,
    pagina: Number.isFinite(pagina) && pagina > 1 ? pagina : 1,
  };
}

/**
 * Lo que vale lo de siempre no se escribe. Con `seccion`, la base es la página
 * de esa categoría: todo lo que arma direcciones del catálogo pasa por acá.
 */
export function urlDeTienda(filtros: Partial<FiltrosDeTienda>): string {
  const f = { ...FILTROS_DE_TIENDA_VACIOS, ...filtros };
  const base = rutaDeTienda(f.seccion);
  const params = new URLSearchParams();

  if (f.q) params.set("q", f.q);
  for (const slug of f.categoria) params.append("categoria", slug);
  for (const slug of f.marca) params.append("marca", slug);
  for (const slug of f.color) params.append("color", slug);
  if (f.precioMin !== null) params.set("precioMin", String(f.precioMin));
  if (f.precioMax !== null) params.set("precioMax", String(f.precioMax));
  if (f.oferta) params.set("oferta", "1");
  if (f.orden !== "relevancia") params.set("orden", f.orden);
  if (f.pagina > 1) params.set("pagina", String(f.pagina));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

export function urlDeCategoria(slug: string): string {
  return `/categorias/${slug}`;
}

export function rutaDeTienda(seccion: string | null): string {
  return seccion ? urlDeCategoria(seccion) : "/productos";
}

/** Vuelve a la página 1: en la 3, un filtro nuevo daría un falso «sin resultados». */
export function urlCambiando(
  filtros: FiltrosDeTienda,
  cambio: Partial<FiltrosDeTienda>,
): string {
  return urlDeTienda({ ...filtros, ...cambio, pagina: 1 });
}

/**
 * La categoría de la página pasa a ser un filtro de `/productos`: elegir otra
 * en el drawer la suma. En `/productos` devuelve lo mismo.
 */
export function comoFiltroDeCategoria(f: FiltrosDeTienda): FiltrosDeTienda {
  if (!f.seccion) return f;
  return { ...f, seccion: null, categoria: [f.seccion, ...f.categoria] };
}

export function urlDePagina(filtros: FiltrosDeTienda, pagina: number): string {
  return urlDeTienda({ ...filtros, pagina });
}

/** Respeta `MAXIMO_POR_FILTRO` también acá, no solo al leer la URL. */
export function alternar(lista: readonly string[], id: string): string[] {
  if (lista.includes(id)) return lista.filter((x) => x !== id);
  if (lista.length >= MAXIMO_POR_FILTRO) return [...lista];
  return [...lista, id];
}

/** Búsqueda o filtros; el orden y la página no cuentan. */
export function hayFiltrosDeTienda(f: FiltrosDeTienda): boolean {
  return contarFiltrosDeTienda(f) > 0 || f.q !== "";
}

/**
 * Cuenta valores, no grupos, como los chips. La búsqueda no cuenta y el precio
 * cuenta una vez.
 */
export function contarFiltrosDeTienda(f: FiltrosDeTienda): number {
  return (
    f.categoria.length +
    f.marca.length +
    f.color.length +
    (f.oferta ? 1 : 0) +
    (f.precioMin !== null || f.precioMax !== null ? 1 : 0)
  );
}

/** Conserva el orden y la categoría de la página. */
export function sinFiltrosDeTienda(f: FiltrosDeTienda): FiltrosDeTienda {
  return { ...FILTROS_DE_TIENDA_VACIOS, orden: f.orden, seccion: f.seccion };
}

export function urlSinFiltros(f: FiltrosDeTienda): string {
  return urlDeTienda(sinFiltrosDeTienda(f));
}

/**
 * Solo el catálogo sin filtros ni otro orden, en cualquier página y también
 * en la página de una categoría. Lo demás sale `noindex, follow`, no `Disallow`.
 */
export function catalogoIndexable(f: FiltrosDeTienda): boolean {
  return !hayFiltrosDeTienda(f) && f.orden === FILTROS_DE_TIENDA_VACIOS.orden;
}
