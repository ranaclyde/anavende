import { z } from "zod";

/**
 * Validación de las acciones del panel sobre una orden — FS RF-23. Tarea F7.3.
 *
 * No es `server-only`: el diálogo usa el tope para limitar el campo y contar
 * lo que queda, igual que el motivo de la baja (F5.8).
 */

/** Alcanza para explicar por qué se canceló, sin invitar a escribir una carta. */
export const MAXIMO_DEL_MOTIVO = 300;

/**
 * El motivo de la cancelación es **opcional** — RF-23 dice que la
 * administradora *puede* registrarlo, no que deba. Es lo contrario del
 * bloqueo (RF-27) y de la baja de cuenta (F5.8), donde la base misma lo
 * exige con un `CHECK`: ahí el motivo es la justificación de algo que se le
 * hace a una persona, y acá es una nota sobre un pedido que muchas veces ya
 * se habló por WhatsApp.
 *
 * **Sin `.transform()` a `null`, aunque sea vacío lo que hay que guardar.**
 * El envoltorio tipa la entrada con la *salida* del esquema (`lib/action.ts`),
 * así que una transformación acá obligaría a quien llama a mandar el campo
 * siempre — el mismo tropiezo que F7.2 tuvo con `default(false)`. La cadena
 * vacía se convierte en la acción, que es donde se escribe la fila.
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
