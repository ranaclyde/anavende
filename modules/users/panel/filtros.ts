/**
 * Filtros del listado de usuarios del panel — FS RF-26, §10.2. Tarea F7.6.
 *
 * RF-26 pide búsqueda por nombre o email y filtros por **estado** y por
 * **rol**. El estado tiene hoy dos valores y va a tener tres: la baja de
 * cuenta (RF-34) es un estado propio, distinto del bloqueo (RN-13), y lo
 * agrega F7.9 —que es la tarea que la ejecuta— sobre esta misma lista.
 *
 * **No es `server-only`**: la consulta lee estos valores y la barra los
 * escribe, como en los otros dos listados del panel.
 */

import {
  pagina as leerPagina,
  texto,
  unaDe,
  type ParametrosDeBusqueda,
} from "@/lib/filtros-url";

export type { ParametrosDeBusqueda };

export const ROLES = [
  { valor: "todos", etiqueta: "Todos los roles" },
  { valor: "admin", etiqueta: "Administradoras" },
  { valor: "customer", etiqueta: "Compradores" },
] as const;

export type FiltroDeRol = (typeof ROLES)[number]["valor"];

export const ESTADOS = [
  { valor: "todos", etiqueta: "Activos y bloqueados" },
  { valor: "activos", etiqueta: "Solo activos" },
  { valor: "bloqueados", etiqueta: "Solo bloqueados" },
] as const;

export type FiltroDeEstado = (typeof ESTADOS)[number]["valor"];

export type FiltrosDeUsuarios = {
  /** Nombre, apellido o email. */
  q: string;
  rol: FiltroDeRol;
  estado: FiltroDeEstado;
  pagina: number;
};

export const FILTROS_VACIOS: FiltrosDeUsuarios = {
  q: "",
  rol: "todos",
  estado: "todos",
  pagina: 1,
};

/** El mismo tope que los otros listados del panel: filas de 44px (§6.9). */
export const POR_PAGINA = 40;

export function leerFiltros(params: ParametrosDeBusqueda): FiltrosDeUsuarios {
  return {
    q: texto(params.q),
    rol: unaDe(params.rol, ROLES, FILTROS_VACIOS.rol),
    estado: unaDe(params.estado, ESTADOS, FILTROS_VACIOS.estado),
    pagina: leerPagina(params.pagina),
  };
}

/**
 * La URL que representa estos filtros. Lo que coincide con el valor de siempre
 * no se escribe: el listado sin tocar es `/admin/usuarios` a secas.
 */
export function urlDeFiltros(
  filtros: FiltrosDeUsuarios,
  base = "/admin/usuarios",
): string {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.rol !== "todos") params.set("rol", filtros.rol);
  if (filtros.estado !== "todos") params.set("estado", filtros.estado);
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

/** Si hay algo que limpiar. */
export function hayFiltros(filtros: FiltrosDeUsuarios): boolean {
  return (
    filtros.q !== "" || filtros.rol !== "todos" || filtros.estado !== "todos"
  );
}
