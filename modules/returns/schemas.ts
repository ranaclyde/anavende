import { z } from "zod";

/**
 * Validación de las devoluciones del panel — FS RF-25. Tarea F7.5.
 *
 * No es `server-only`: el diálogo usa los topes para limitar los campos y
 * contar lo que queda, igual que la cancelación de F7.3 y la baja de F5.8.
 */

/** Alcanza para explicar una devolución, sin invitar a escribir una carta. */
export const MAXIMO_DEL_MOTIVO = 300;

/**
 * El motivo de la devolución es **obligatorio**, y no por gusto: `returns.reason`
 * es `NOT NULL` en la base (§5.7). Es lo contrario de la cancelación de RF-23,
 * donde la administradora *puede* registrarlo — una orden que se cancela
 * muchas veces ya se habló por WhatsApp, y una devolución es mercadería que
 * vuelve y plata que se devuelve: dentro de un mes, «devolución sin motivo»
 * no le sirve a nadie.
 */
const motivoObligatorio = z
  .string()
  .trim()
  .min(1, "Contá por qué se devuelve.")
  .max(MAXIMO_DEL_MOTIVO, `Hasta ${MAXIMO_DEL_MOTIVO} caracteres.`);

/**
 * Un renglón a devolver.
 *
 * **El tope no se valida acá**, y es a propósito: «no más de lo vendido ni de
 * lo ya devuelto» se calcula contra la base con la orden bloqueada
 * (`registrar.ts`), porque entre que la pantalla se pintó y llegó el clic
 * pudo registrarse otra devolución. Lo que este esquema cuida es la forma —un
 * entero positivo, un `uuid`, un booleano— y el disparate: 10.000 unidades de
 * algo no es un error de tipeo que valga la pena consultar a la base.
 *
 * **`repone` no tiene valor por omisión.** Es la decisión que RF-25 pide tomar
 * por cada ítem —¿vuelve a la góndola o está roto?— y el `default` la tomaría
 * solo, escribiendo stock que nadie confirmó.
 */
const renglonADevolver = z.object({
  /** El renglón de la orden, no la variante: una orden puede repetir producto. */
  itemId: z.uuid(),
  cantidad: z.number().int().min(1).max(9999),
  repone: z.boolean(),
  /**
   * El motivo del renglón, que la pantalla sólo pide cuando **no** repone: ahí
   * es donde dice algo que el general no dice («llegó con la pantalla rota»).
   * Opcional en la base (`return_items.reason` admite `null`) y opcional acá.
   */
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

/**
 * Anular una devolución — RF-25: «no se edita: se anula, revirtiendo el efecto
 * en stock, y se vuelve a cargar».
 *
 * **Con motivo obligatorio**, como el bloqueo de RF-27 y al revés de la
 * cancelación de una orden: anular corrige un asiento que ya movió stock, y el
 * único registro de por qué se movió y se desmovió es éste.
 */
export const anulacionDeDevolucion = z.object({
  returnId: z.uuid(),
  motivo: motivoObligatorio,
});
