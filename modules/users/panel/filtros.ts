// No es `server-only`: la consulta lee estos valores y la barra los escribe.

import {
  pageParam as leerPagina,
  paramText,
  oneOf,
  type SearchParamsRecord,
} from "@/lib/url-filters";

export type { SearchParamsRecord };

export const ROLES = [
  { valor: "todos", etiqueta: "Todos los roles" },
  { valor: "admin", etiqueta: "Administradoras" },
  { valor: "customer", etiqueta: "Compradores" },
] as const;

export type FiltroDeRol = (typeof ROLES)[number]["valor"];

/**
 * «Baja pedida» no es un estado de la cuenta (sigue activa, en solo lectura)
 * sino trabajo por hacer: es a donde lleva el aviso de pendientes del panel.
 */
export const ESTADOS = [
  { valor: "todos", etiqueta: "Todas" },
  { valor: "activos", etiqueta: "Activas" },
  { valor: "bloqueados", etiqueta: "Bloqueadas" },
  { valor: "baja-pedida", etiqueta: "Baja pedida" },
  { valor: "dados-de-baja", etiqueta: "Dadas de baja" },
] as const;

export type FiltroDeEstado = (typeof ESTADOS)[number]["valor"];

export type FiltrosDeUsuarios = {
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

export const POR_PAGINA = 40;

export function leerFiltros(params: SearchParamsRecord): FiltrosDeUsuarios {
  return {
    q: paramText(params.q),
    rol: oneOf(params.rol, ROLES, FILTROS_VACIOS.rol),
    estado: oneOf(params.estado, ESTADOS, FILTROS_VACIOS.estado),
    pagina: leerPagina(params.pagina),
  };
}

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

/** El estado no cuenta: es una solapa, y «Limpiar todo» no cambia de solapa. */
export function hayFiltros(filtros: FiltrosDeUsuarios): boolean {
  return filtros.q !== "" || filtros.rol !== "todos";
}

export function sinFiltros(filtros: FiltrosDeUsuarios): FiltrosDeUsuarios {
  return { ...FILTROS_VACIOS, estado: filtros.estado };
}
