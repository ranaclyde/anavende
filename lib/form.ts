import type { ActionResult } from "@/lib/action";

/**
 * Traduce la respuesta de una Server Action a lo que el formulario necesita
 * pintar: un mensaje general y los errores colgados de cada campo.
 *
 * El envoltorio devuelve los errores de Zod con `treeifyError`, que es un
 * árbol; acá se aplana a `{ campo: mensaje }` porque un campo muestra un
 * mensaje, no una lista (DESIGN-REFERENCE §6.6).
 */

type ArbolDeErrores = {
  errors?: string[];
  properties?: Record<string, { errors?: string[] } | undefined>;
};

export type ErroresDeFormulario<C extends string = string> = {
  general: string | null;
  campos: Partial<Record<C, string>>;
  /** El código de dominio, para cuando la vista reacciona distinto según cuál. */
  codigo: string | null;
  detalles: Record<string, unknown> | null;
};

export const SIN_ERRORES: ErroresDeFormulario = {
  general: null,
  campos: {},
  codigo: null,
  detalles: null,
};

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
    // Si el problema está en un campo concreto, el mensaje general sobra:
    // repetirlo arriba y abajo hace que parezcan dos problemas distintos.
    general: Object.keys(campos).length ? null : resultado.message,
    campos,
    codigo: resultado.code,
    detalles,
  };
}
