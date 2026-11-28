import type { ActionResult } from "@/lib/action";

type ErrorTree = {
  errors?: string[];
  properties?: Record<string, { errors?: string[] } | undefined>;
};

export type FormErrors<C extends string = string> = {
  general: string | null;
  fields: Partial<Record<C, string>>;
  code: string | null;
  details: Record<string, unknown> | null;
};

export const NO_ERRORS: FormErrors = {
  general: null,
  fields: {},
  code: null,
  details: null,
};

/**
 * Aplana el árbol de `treeifyError` a `{ field: mensaje }`: un mensaje por
 * campo.
 */
export function readErrors<C extends string = string>(
  result: Extract<ActionResult<unknown>, { ok: false }>,
): FormErrors<C> {
  const details = result.details ?? null;
  const tree = details?.fields as ErrorTree | undefined;

  const fields: Partial<Record<C, string>> = {};
  for (const [field, value] of Object.entries(tree?.properties ?? {})) {
    const first = value?.errors?.[0];
    if (first) fields[field as C] = first;
  }

  return {
    // Repetido arriba y en el campo parecerían dos problemas distintos.
    general: Object.keys(fields).length ? null : result.message,
    fields,
    code: result.code,
    details,
  };
}

/**
 * Los errores de un objeto anidado (`direccion.street`): `readErrors` aplana
 * un solo nivel.
 */
export function sectionErrors<C extends string = string>(
  result: Extract<ActionResult<unknown>, { ok: false }>,
  section: string,
): Partial<Record<C, string>> {
  const tree = result.details?.fields as ErrorTree | undefined;
  const branch = tree?.properties?.[section] as ErrorTree | undefined;

  const fields: Partial<Record<C, string>> = {};
  for (const [field, value] of Object.entries(branch?.properties ?? {})) {
    const first = value?.errors?.[0];
    if (first) fields[field as C] = first;
  }
  return fields;
}
