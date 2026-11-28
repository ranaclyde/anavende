import { z } from "zod";

// No es `server-only`: el diálogo usa los topes para limitar los campos.
export const MAXIMO_DEL_MOTIVO = 300;

/** Obligatorio: `returns.reason` es `NOT NULL` (§5.7). */
const motivoObligatorio = z
  .string()
  .trim()
  .min(1, "Contá por qué se devuelve.")
  .max(MAXIMO_DEL_MOTIVO, `Hasta ${MAXIMO_DEL_MOTIVO} caracteres.`);

/**
 * El tope «no más de lo vendido ni de lo ya devuelto» no se valida acá: se
 * calcula contra la base con la orden bloqueada (`registrar.ts`).
 *
 * `repone` no tiene valor por omisión a propósito: un `default` escribiría
 * stock que nadie confirmó.
 */
const renglonADevolver = z.object({
  /** El renglón de la orden, no la variante: una orden puede repetir producto. */
  itemId: z.uuid(),
  cantidad: z.number().int().min(1).max(9999),
  repone: z.boolean(),
  /** Solo se pide cuando no repone. */
  motivo: z
    .string()
    .trim()
    .max(MAXIMO_DEL_MOTIVO, `Hasta ${MAXIMO_DEL_MOTIVO} caracteres.`)
    .optional(),
});

export const devolucionDelPanel = z.object({
  numero: z.number().int().positive(),
  motivo: motivoObligatorio,
  items: z
    .array(renglonADevolver)
    .min(1, "Elegí al menos un producto para devolver."),
});

/** RF-25: no se edita, se anula revirtiendo el stock. Motivo obligatorio. */
export const anulacionDeDevolucion = z.object({
  returnId: z.uuid(),
  motivo: motivoObligatorio,
});
