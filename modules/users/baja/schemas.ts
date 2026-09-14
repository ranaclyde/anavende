import { z } from "zod";

/**
 * Validación del pedido de baja — RF-34 · TS §6.2, paso 3. Tarea F5.8.
 *
 * No es `server-only`: el formulario usa el tope para contar caracteres.
 */

/** Alcanza para explicarse, y no invita a pegar un documento. */
export const MAXIMO_DEL_MOTIVO = 500;

export const pedidoDeBaja = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, "Contanos por qué te querés ir: es obligatorio.")
    .max(MAXIMO_DEL_MOTIVO, `Hasta ${MAXIMO_DEL_MOTIVO} caracteres.`),
});

export const sinDatos = z.object({});
