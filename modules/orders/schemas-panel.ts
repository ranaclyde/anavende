import { z } from "zod";

// Sin `server-only`: el diálogo usa el tope para limitar el campo.

export const MAXIMO_DEL_MOTIVO = 300;

/**
 * Sin `.transform()` a `null`: el envoltorio tipa la entrada con la salida del
 * esquema y obligaría a mandar el campo siempre. La cadena vacía la convierte la acción.
 */
export const cancelacionDelPanel = z.object({
  numero: z.number().int().positive(),
  motivo: z
    .string()
    .trim()
    .max(MAXIMO_DEL_MOTIVO, `Hasta ${MAXIMO_DEL_MOTIVO} caracteres.`)
    .optional(),
});

export const laOrdenDelPanel = z.object({
  numero: z.number().int().positive(),
});
