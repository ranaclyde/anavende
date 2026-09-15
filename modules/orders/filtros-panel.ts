/**
 * Solapas, filtros y búsqueda del listado de órdenes del panel — RF-21, §10.2.
 * Tarea F7.1.
 *
 * **No es `server-only`**, por lo mismo que `catalog/products/filtros.ts`: el
 * estado del listado vive en la URL, así que la consulta tiene que leerlo y la
 * barra tiene que escribirlo. Con una copia de cada lado, el día que uno
 * cambie el otro deja de encontrar y no lo dice.
 */

import type { EstadoOrden } from "@/modules/orders/estados";

/**
 * Las solapas de RF-21, y por qué son solapas y no un `<select>` más.
 *
 * Son la pregunta que la vendedora se hace al abrir la pantalla —«¿qué tengo
 * que preparar?»— y no un filtro entre otros. Escondida en una lista
 * desplegable, esa pregunta cuesta dos clics; a la vista, cambiar de solapa es
 * uno solo y además se ve en cuál está parada.
 *
 * **La que viene de fábrica es «Activas»**: el listado se abre en lo que hay
 * por hacer, no en el archivo histórico. `/admin/ordenes` a secas es eso.
 */
export const SOLAPAS = [
  { valor: "activas", etiqueta: "Activas", estado: "activa" },
  { valor: "finalizadas", etiqueta: "Finalizadas", estado: "finalizada" },
  { valor: "canceladas", etiqueta: "Canceladas", estado: "cancelada" },
  { valor: "todas", etiqueta: "Todas", estado: null },
] as const satisfies readonly {
  valor: string;
  etiqueta: string;
  estado: EstadoOrden | null;
}[];

export type Solapa = (typeof SOLAPAS)[number]["valor"];

/** El estado que filtra cada solapa. `null` en «Todas». */
export function estadoDeLaSolapa(solapa: Solapa): EstadoOrden | null {
  return SOLAPAS.find((s) => s.valor === solapa)!.estado;
}

export const ORIGENES = [
  { valor: "todos", etiqueta: "Web y manuales" },
  { valor: "web", etiqueta: "Solo web" },
  { valor: "manual", etiqueta: "Solo manuales" },
] as const;

export type FiltroDeOrigen = (typeof ORIGENES)[number]["valor"];

export type FiltrosDeOrdenes = {
  solapa: Solapa;
  /** Número de orden, nombre o email del comprador. */
  q: string;
  origen: FiltroDeOrigen;
  /** `AAAA-MM-DD` o `""`. Es lo que escribe y lee un `<input type="date">`. */
  desde: string;
  hasta: string;
  pagina: number;
};

export const FILTROS_VACIOS: FiltrosDeOrdenes = {
  solapa: "activas",
  q: "",
  origen: "todos",
  desde: "",
  hasta: "",
  pagina: 1,
};

/**
 * Cuántas por página.
 *
 * **La tienda pagina de a 24 y acá son 40**, y la diferencia no es un
 * descuido: allá cada renglón es una tarjeta con foto en una grilla, y acá es
 * una fila de 44px en una tabla que se recorre con la vista (§6.9). Cuarenta
 * filas entran en dos pantallas de escritorio; veinticuatro obligarían a
 * paginar un martes cualquiera.
 */
export const POR_PAGINA = 40;

/** Lo que Next entrega tras hacerle `await` a `searchParams` (§10.2). */
export type ParametrosDeBusqueda = Record<
  string,
  string | string[] | undefined
>;

function texto(valor: string | string[] | undefined): string {
  // Un parámetro repetido —`?q=a&q=b`— llega como arreglo. Se toma el primero
  // en vez de fallar: la URL la escribe cualquiera, no solo la barra.
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

function unaDe<T extends string>(
  valor: string | string[] | undefined,
  opciones: readonly { valor: T }[],
  porDefecto: T,
): T {
  const v = texto(valor);
  return opciones.some((o) => o.valor === v) ? (v as T) : porDefecto;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Una fecha del calendario, o `""`.
 *
 * Se valida la **forma y el valor**: `2026-02-31` tiene forma de fecha y no
 * existe, y entraría a Postgres para hacerlo fallar. Lo que no se reconoce se
 * descarta, como todo lo demás acá.
 */
function fecha(valor: string | string[] | undefined): string {
  const v = texto(valor);
  if (!FECHA.test(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v
    ? ""
    : v;
}

/**
 * Lee los filtros de la URL sin fallar nunca.
 *
 * Mismo criterio que el listado de productos: un valor que no se reconoce se
 * descarta y queda el de siempre. La URL es editable a mano y compartible, y
 * un listado que devuelve un error porque alguien borró media palabra del
 * enlace es un callejón sin salida.
 *
 * **Las fechas dadas vuelta se enderezan** en vez de devolver cero
 * resultados: pedir «del 30 al 1» es evidentemente un rango, y contestarlo con
 * una tabla vacía es dejar a quien pregunta creyendo que no hubo ventas.
 */
export function leerFiltros(params: ParametrosDeBusqueda): FiltrosDeOrdenes {
  const desde = fecha(params.desde);
  const hasta = fecha(params.hasta);
  const alReves = desde && hasta && desde > hasta;
  const pagina = Number.parseInt(texto(params.pagina), 10);

  return {
    solapa: unaDe(params.estado, SOLAPAS, FILTROS_VACIOS.solapa),
    q: texto(params.q),
    origen: unaDe(params.origen, ORIGENES, FILTROS_VACIOS.origen),
    desde: alReves ? hasta : desde,
    hasta: alReves ? desde : hasta,
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  };
}

/**
 * La URL que representa estos filtros.
 *
 * Lo que coincide con el valor de siempre NO se escribe: la dirección de un
 * listado sin tocar es `/admin/ordenes` a secas, y la de uno filtrado dice
 * exactamente qué se cambió.
 */
export function urlDeFiltros(
  filtros: FiltrosDeOrdenes,
  base = "/admin/ordenes",
): string {
  const params = new URLSearchParams();
  if (filtros.solapa !== "activas") params.set("estado", filtros.solapa);
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.origen !== "todos") params.set("origen", filtros.origen);
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

/** Si hay algo que limpiar: la búsqueda y los filtros, no la solapa. */
export function hayFiltros(filtros: FiltrosDeOrdenes): boolean {
  return (
    filtros.q !== "" ||
    filtros.origen !== "todos" ||
    filtros.desde !== "" ||
    filtros.hasta !== ""
  );
}

/**
 * Limpia la búsqueda y los filtros, y **conserva la solapa**: quien está
 * mirando las canceladas y limpia los filtros quiere seguir en canceladas.
 */
export function sinFiltros(filtros: FiltrosDeOrdenes): FiltrosDeOrdenes {
  return { ...FILTROS_VACIOS, solapa: filtros.solapa };
}
