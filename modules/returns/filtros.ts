/**
 * Filtros del listado de devoluciones — FS RF-25, §10.2. Tarea F7.5.
 *
 * RF-25 pide el listado «con filtros por fecha y por reposición». El de estado
 * se suma por lo mismo que las solapas del listado de órdenes: una anulada y
 * una vigente conviven en la tabla, y en algún momento hay que poder mirar
 * sólo las que valen.
 *
 * **No es `server-only`**: la consulta lee estos valores y la barra los
 * escribe, como en el listado de órdenes (F7.1).
 */

import {
  fecha,
  pagina as leerPagina,
  unaDe,
  type ParametrosDeBusqueda,
} from "@/lib/filtros-url";

export type { ParametrosDeBusqueda };

/**
 * **«Todas» de fábrica, y las anuladas se ven.**
 *
 * Es la decisión contraria a esconderlas: una devolución anulada no se borra
 * —revertir el stock deja rastro, y de eso se trata RF-25—, así que sacarla
 * del listado por omisión haría que quien la registró por error no la
 * encuentre para entender qué pasó. Va etiquetada, que es lo que la distingue.
 */
export const ESTADOS = [
  { valor: "todas", etiqueta: "Registradas y anuladas" },
  { valor: "registradas", etiqueta: "Solo registradas" },
  { valor: "anuladas", etiqueta: "Solo anuladas" },
] as const;

export type FiltroDeEstado = (typeof ESTADOS)[number]["valor"];

/**
 * **Una devolución «con reposición» es la que repone algo**, aunque no sea
 * todo: la misma devolución puede traer un auricular en caja y otro roto.
 * «Sin reposición» es la que no repone nada, que es la que pregunta por
 * mercadería que se descartó.
 */
export const REPOSICIONES = [
  { valor: "todas", etiqueta: "Repongan o no" },
  { valor: "con", etiqueta: "Con reposición" },
  { valor: "sin", etiqueta: "Sin reposición" },
] as const;

export type FiltroDeReposicion = (typeof REPOSICIONES)[number]["valor"];

export type FiltrosDeDevoluciones = {
  estado: FiltroDeEstado;
  reposicion: FiltroDeReposicion;
  /** `AAAA-MM-DD` o `""`. Es lo que escribe y lee un `<input type="date">`. */
  desde: string;
  hasta: string;
  pagina: number;
};

export const FILTROS_VACIOS: FiltrosDeDevoluciones = {
  estado: "todas",
  reposicion: "todas",
  desde: "",
  hasta: "",
  pagina: 1,
};

/** El mismo tope que las órdenes: es la misma tabla de filas de 44px (§6.9). */
export const POR_PAGINA = 40;

/**
 * **Las fechas dadas vuelta se enderezan** en vez de devolver cero
 * resultados, igual que en las órdenes: pedir «del 30 al 1» es evidentemente
 * un rango, y contestarlo con una tabla vacía deja creyendo que no hubo
 * ninguna devolución.
 */
export function leerFiltros(
  params: ParametrosDeBusqueda,
): FiltrosDeDevoluciones {
  const desde = fecha(params.desde);
  const hasta = fecha(params.hasta);
  const alReves = desde && hasta && desde > hasta;

  return {
    estado: unaDe(params.estado, ESTADOS, FILTROS_VACIOS.estado),
    reposicion: unaDe(
      params.reposicion,
      REPOSICIONES,
      FILTROS_VACIOS.reposicion,
    ),
    desde: alReves ? hasta : desde,
    hasta: alReves ? desde : hasta,
    pagina: leerPagina(params.pagina),
  };
}

/**
 * La URL que representa estos filtros. Lo que coincide con el valor de siempre
 * no se escribe: el listado sin tocar es `/admin/devoluciones` a secas.
 */
export function urlDeFiltros(
  filtros: FiltrosDeDevoluciones,
  base = "/admin/devoluciones",
): string {
  const params = new URLSearchParams();
  if (filtros.estado !== "todas") params.set("estado", filtros.estado);
  if (filtros.reposicion !== "todas") {
    params.set("reposicion", filtros.reposicion);
  }
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

/** Si hay algo que limpiar. */
export function hayFiltros(filtros: FiltrosDeDevoluciones): boolean {
  return (
    filtros.estado !== "todas" ||
    filtros.reposicion !== "todas" ||
    filtros.desde !== "" ||
    filtros.hasta !== ""
  );
}
