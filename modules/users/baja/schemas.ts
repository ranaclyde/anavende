import { z } from "zod";

// No es `server-only`: el formulario usa el tope para contar caracteres.

export const MAXIMO_DEL_MOTIVO = 500;

export const pedidoDeBaja = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, "Contanos por qué te querés ir: es obligatorio.")
    .max(MAXIMO_DEL_MOTIVO, `Hasta ${MAXIMO_DEL_MOTIVO} caracteres.`),
});

export const sinDatos = z.object({});
