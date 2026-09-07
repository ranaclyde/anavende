/**
 * Filtros, orden y paginación del catálogo público — F3.4, RF-02, §10.2.
 *
 * Hermano de `filtros.ts`, que hace lo mismo para el panel, y separado a
 * propósito: **las preguntas no son las mismas**. La vendedora filtra por
 * estado y por stock —qué hay que reponer, qué está desactivado—; el comprador
 * no sabe que existe el concepto «inactivo» y le importan cosas que al panel no
 * le importan, como ver solo lo que está en oferta.
 *
 * Tampoco es `server-only`: el estado vive en la URL, así que lo lee la
 * consulta y lo escribe la barra de filtros. Una sola copia de los nombres de
 * los parámetros, o el día que uno cambie el otro deja de encontrar sin avisar.
 */

export const ORDENES_DE_TIENDA = [
  { valor: "relevancia", etiqueta: "Destacados" },
  { valor: "precio-asc", etiqueta: "Menor precio" },
  { valor: "precio-desc", etiqueta: "Mayor precio" },
  { valor: "nombre", etiqueta: "Nombre (A-Z)" },
  { valor: "novedades", etiqueta: "Más nuevos" },
] as const;

export type OrdenDeTienda = (typeof ORDENES_DE_TIENDA)[number]["valor"];

export type FiltrosDeTienda = {
  q: string;
  /** UUID de la categoría, o `""` = todas. */
  categoria: string;
  /** UUID de la marca, o `""` = todas. */
  marca: string;
  /** Solo lo que tiene descuento (RN-04b). */
  oferta: boolean;
  orden: OrdenDeTienda;
  /** 1-based. Fuera de rango se corrige a 1: la URL la escribe cualquiera. */
  pagina: number;
};

/** §10.2: «paginación por LIMIT/OFFSET con 24 por página». */
export const POR_PAGINA = 24;

export const FILTROS_DE_TIENDA_VACIOS: FiltrosDeTienda = {
  q: "",
  categoria: "",
  marca: "",
  oferta: false,
  orden: "relevancia",
  pagina: 1,
};

export type ParametrosDeBusqueda = Record<
  string,
  string | string[] | undefined
>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(valor: string | string[] | undefined): string {
  // `?q=a&q=b` llega como arreglo. Se toma el primero en vez de fallar.
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

/**
 * Lee la URL sin fallar nunca.
 *
 * Es la misma decisión que el panel y por el mismo motivo: la dirección es
 * compartible y editable a mano, así que un valor que no se reconoce se
 * descarta y queda el de siempre. Un catálogo que devuelve un error porque
 * alguien recortó el enlace al pegarlo en WhatsApp es un callejón sin salida,
 * y en la tienda esa persona además se va.
 */
export function leerFiltrosDeTienda(
  params: ParametrosDeBusqueda,
): FiltrosDeTienda {
  const categoria = texto(params.categoria);
  const marca = texto(params.marca);
  const orden = texto(params.orden);
  const pagina = Number.parseInt(texto(params.pagina), 10);

  return {
    q: texto(params.q),
    // Los UUID se validan ANTES de la consulta: sin esto `?marca=hola` no
    // filtraría de menos, haría fallar a Postgres.
    categoria: UUID.test(categoria) ? categoria : "",
    marca: UUID.test(marca) ? marca : "",
    oferta: texto(params.oferta) === "1",
    orden: ORDENES_DE_TIENDA.some((o) => o.valor === orden)
      ? (orden as OrdenDeTienda)
      : FILTROS_DE_TIENDA_VACIOS.orden,
    pagina: Number.isFinite(pagina) && pagina > 1 ? pagina : 1,
  };
}

/**
 * La URL que representa estos filtros.
 *
 * Lo que vale lo de siempre NO se escribe: un catálogo sin tocar es
 * `/productos` a secas. Y **la página se cae al cambiar cualquier filtro**, que
 * es la trampa clásica: estar en la página 3 de «todo», filtrar por una marca
 * con nueve productos y caer en un «sin resultados» que no es cierto.
 */
export function urlDeTienda(
  filtros: Partial<FiltrosDeTienda>,
  base = "/productos",
): string {
  const f = { ...FILTROS_DE_TIENDA_VACIOS, ...filtros };
  const params = new URLSearchParams();

  if (f.q) params.set("q", f.q);
  if (f.categoria) params.set("categoria", f.categoria);
  if (f.marca) params.set("marca", f.marca);
  if (f.oferta) params.set("oferta", "1");
  if (f.orden !== "relevancia") params.set("orden", f.orden);
  if (f.pagina > 1) params.set("pagina", String(f.pagina));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

/** Cambiar un filtro vuelve a la página 1. Ver `urlDeTienda`. */
export function urlCambiando(
  filtros: FiltrosDeTienda,
  cambio: Partial<FiltrosDeTienda>,
): string {
  return urlDeTienda({ ...filtros, ...cambio, pagina: 1 });
}

/** Ir a otra página conserva todo lo demás. */
export function urlDePagina(
  filtros: FiltrosDeTienda,
  pagina: number,
): string {
  return urlDeTienda({ ...filtros, pagina });
}

/** Si hay algo que limpiar: búsqueda o filtros, no el orden ni la página. */
export function hayFiltrosDeTienda(f: FiltrosDeTienda): boolean {
  return f.q !== "" || f.categoria !== "" || f.marca !== "" || f.oferta;
}

/** Limpia búsqueda y filtros; conserva el orden elegido (§10.2). */
export function sinFiltrosDeTienda(f: FiltrosDeTienda): FiltrosDeTienda {
  return { ...FILTROS_DE_TIENDA_VACIOS, orden: f.orden };
}
