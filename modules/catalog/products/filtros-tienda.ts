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
 *
 * **Categoría, marca y color son multiselección desde el 2026-09-08**, que es
 * lo que RF-02 pedía desde el principio. Van repetidos en la dirección
 * —`?marca=a&marca=b`— y no separados por comas: es la forma que entienden
 * `URLSearchParams.getAll`, un formulario con varios campos del mismo nombre y
 * el `searchParams` de Next, los tres sin código de por medio.
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
  /** UUID de categorías. Vacío = todas. */
  categoria: readonly string[];
  /** UUID de marcas. Vacío = todas. */
  marca: readonly string[];
  /**
   * UUID de colores. RF-02: el producto entra si **alguna** de sus variantes
   * tiene **alguno** de estos colores.
   */
  color: readonly string[];
  /** Pesos enteros sobre el precio FINAL (RN-04b). `null` = sin tope. */
  precioMin: number | null;
  precioMax: number | null;
  /** Solo lo que tiene descuento (RN-04b). */
  oferta: boolean;
  orden: OrdenDeTienda;
  /** 1-based. Fuera de rango se corrige a 1: la URL la escribe cualquiera. */
  pagina: number;
};

/** §10.2: «paginación por LIMIT/OFFSET con 24 por página». */
export const POR_PAGINA = 24;

/**
 * Cuántos valores se aceptan por filtro.
 *
 * No es una limitación de producto —nadie elige veinte marcas a mano—: es que
 * la dirección la escribe cualquiera, y `?marca=` repetido quinientas veces
 * arma un `IN` de quinientos elementos con una sola pegada de texto. Veinte
 * está por encima de cualquier uso real y por debajo de cualquier abuso.
 */
export const MAXIMO_POR_FILTRO = 20;

/** Diez dígitos enteros: lo que entra en `numeric(12,2)`. Ver `pesos`. */
const TOPE_DE_PRECIO = 9_999_999_999;

export const FILTROS_DE_TIENDA_VACIOS: FiltrosDeTienda = {
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

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(valor: string | string[] | undefined): string {
  // `?q=a&q=b` llega como arreglo. Se toma el primero en vez de fallar.
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

/**
 * Los UUID válidos de un parámetro repetido, sin repetidos y con tope.
 *
 * Se pasan a minúsculas porque es como los devuelve Postgres, y así
 * `?marca=ABC…` sigue coincidiendo con la opción de la lista en vez de quedar
 * aplicado pero sin chip que lo saque.
 */
function lista(valor: string | string[] | undefined): string[] {
  const crudos =
    valor === undefined ? [] : Array.isArray(valor) ? valor : [valor];
  const vistos = new Set<string>();

  for (const crudo of crudos) {
    const id = crudo.trim().toLowerCase();
    // Se validan ANTES de la consulta: sin esto `?marca=hola` no filtraría de
    // menos, haría fallar a Postgres.
    if (UUID.test(id)) vistos.add(id);
    if (vistos.size >= MAXIMO_POR_FILTRO) break;
  }

  return [...vistos];
}

/**
 * Un precio de la dirección, en pesos enteros.
 *
 * **Enteros y no decimales**, aunque RN-02 diga que los precios se muestran con
 * centavos: acá el número lo escribe una persona en una caja de texto, y
 * «desde 12.000,50» no es un filtro que alguien quiera poner. Los centavos
 * siguen estando en el precio y en la comparación; lo que se acota es el borde.
 */
function pesos(valor: string | string[] | undefined): number | null {
  const crudo = texto(valor);
  if (crudo === "") return null;

  const n = Number.parseInt(crudo, 10);
  // El tope es el de la COLUMNA, `numeric(12,2)`: diez dígitos enteros. No es
  // una precaución teórica —`formatMoney` tira una excepción con once, y el
  // chip del filtro lo llama—, así que `?precioMax=99999999999` rompería la
  // página en vez de no filtrar nada.
  if (!Number.isSafeInteger(n) || n < 0 || n > TOPE_DE_PRECIO) return null;
  return n;
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
  const orden = texto(params.orden);
  const pagina = Number.parseInt(texto(params.pagina), 10);

  let precioMin = pesos(params.precioMin);
  let precioMax = pesos(params.precioMax);
  // Un rango al revés es un error de tipeo, y se da vuelta en vez de
  // descartarse: «de 5000 a 1000» quiere decir lo mismo al derecho, y tirar el
  // tope dejaría un «desde 5000» que nadie pidió.
  if (precioMin !== null && precioMax !== null && precioMin > precioMax) {
    [precioMin, precioMax] = [precioMax, precioMin];
  }

  return {
    q: texto(params.q),
    categoria: lista(params.categoria),
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
  for (const id of f.categoria) params.append("categoria", id);
  for (const id of f.marca) params.append("marca", id);
  for (const id of f.color) params.append("color", id);
  if (f.precioMin !== null) params.set("precioMin", String(f.precioMin));
  if (f.precioMax !== null) params.set("precioMax", String(f.precioMax));
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

/**
 * Pone o saca un valor de un filtro multiselección.
 *
 * Es lo que hace que **volver a tocar un chip encendido lo apague**, que es el
 * gesto que la gente prueba primero. El tope se aplica también acá: sin él, la
 * validación de la lectura se saltea eligiendo a mano.
 */
export function alternar(lista: readonly string[], id: string): string[] {
  if (lista.includes(id)) return lista.filter((x) => x !== id);
  if (lista.length >= MAXIMO_POR_FILTRO) return [...lista];
  return [...lista, id];
}

/** Si hay algo que limpiar: búsqueda o filtros, no el orden ni la página. */
export function hayFiltrosDeTienda(f: FiltrosDeTienda): boolean {
  return contarFiltrosDeTienda(f) > 0 || f.q !== "";
}

/**
 * Cuántos filtros hay puestos, para el contador del botón «Filtros».
 *
 * **Cuenta VALORES, no grupos**: con dos marcas elegidas dice 2, que es lo que
 * se ve en el panel abierto y lo que se ve en los chips de arriba de la grilla.
 * Contando grupos, sacar una de las dos marcas dejaría el número quieto y
 * parecería que el clic no hizo nada.
 *
 * **La búsqueda no cuenta.** Tiene su propio campo a la vista al lado del
 * botón: sumarla haría que el contador diga «2» con un solo filtro elegido.
 *
 * **El precio cuenta UNA vez** aunque tenga los dos bordes puestos: es un
 * filtro solo, y su chip también es uno.
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

/** Limpia búsqueda y filtros; conserva el orden elegido (§10.2). */
export function sinFiltrosDeTienda(f: FiltrosDeTienda): FiltrosDeTienda {
  return { ...FILTROS_DE_TIENDA_VACIOS, orden: f.orden };
}
