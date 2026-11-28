import type { ActionResult } from "@/lib/action";

type ArbolDeErrores = {
  errors?: string[];
  properties?: Record<string, { errors?: string[] } | undefined>;
};

export type ErroresDeFormulario<C extends string = string> = {
  general: string | null;
  campos: Partial<Record<C, string>>;
  codigo: string | null;
  detalles: Record<string, unknown> | null;
};

export const SIN_ERRORES: ErroresDeFormulario = {
  general: null,
  campos: {},
  codigo: null,
  detalles: null,
};

/**
 * Aplana el árbol de `treeifyError` a `{ campo: mensaje }`: un mensaje por
 * campo.
 */
export function leerErrores<C extends string = string>(
  resultado: Extract<ActionResult<unknown>, { ok: false }>,
): ErroresDeFormulario<C> {
  const detalles = resultado.details ?? null;
  const arbol = detalles?.fields as ArbolDeErrores | undefined;

  const campos: Partial<Record<C, string>> = {};
  for (const [campo, valor] of Object.entries(arbol?.properties ?? {})) {
    const primero = valor?.errors?.[0];
    if (primero) campos[campo as C] = primero;
  }

  return {
    // Repetido arriba y en el campo parecerían dos problemas distintos.
    general: Object.keys(campos).length ? null : resultado.message,
    campos,
    codigo: resultado.code,
    detalles,
  };
}

/**
 * Los errores de un objeto anidado (`direccion.street`): `leerErrores` aplana
 * un solo nivel.
 */
export function erroresDeSeccion<C extends string = string>(
  resultado: Extract<ActionResult<unknown>, { ok: false }>,
  seccion: string,
): Partial<Record<C, string>> {
  const arbol = resultado.details?.fields as ArbolDeErrores | undefined;
  const rama = arbol?.properties?.[seccion] as ArbolDeErrores | undefined;

  const campos: Partial<Record<C, string>> = {};
  for (const [campo, valor] of Object.entries(rama?.properties ?? {})) {
    const primero = valor?.errors?.[0];
    if (primero) campos[campo as C] = primero;
  }
  return campos;
}
