import { z } from "zod";

/**
 * Validación de los medios de pago — RF-19.
 *
 * No es `server-only` como el de productos: acá no hay nada que sanitizar
 * —la descripción es texto plano— y el formulario repite estos mismos
 * esquemas para avisar antes de enviar. Quien decide sigue siendo el
 * servidor, que los vuelve a correr en el envoltorio (§6.2, paso 3).
 */

const nombre = z
  .string()
  .trim()
  .min(2, "El nombre necesita al menos 2 caracteres.")
  .max(60, "El nombre no puede pasar de 60 caracteres.");

/**
 * La descripción corta de RF-19 —«10% off transfiriendo»—, no un párrafo.
 *
 * Se guarda `null` y no `""` cuando está vacía: la columna es opcional, y
 * dos formas de decir «no hay» obligan a preguntar por las dos en cada
 * consulta y en cada pantalla. El tope de 120 no es arbitrario: es lo que
 * entra en la franja de la tienda sin partir la fila (RF-01).
 */
const descripcion = z
  .string()
  .trim()
  .max(120, "La descripción no puede pasar de 120 caracteres.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

export const crearMedioDePago = z.object({
  name: nombre,
  description: descripcion,
});

export const editarMedioDePago = z.object({
  id: z.uuid(),
  name: nombre,
  description: descripcion,
});

export const soloMedioDePago = z.object({ id: z.uuid() });

export const cambioDeEstadoDePago = z.object({
  id: z.uuid(),
  activo: z.boolean(),
});

/**
 * Mover es «uno para arriba» o «uno para abajo», no «poné este número».
 *
 * `sort_order` es una posición y no un dato que la vendedora tenga que
 * llevar: pedirle el número la obliga a renumerar a mano cuando quiere meter
 * uno en el medio, que es justo el trabajo que la computadora hace bien.
 */
export const movimientoDePago = z.object({
  id: z.uuid(),
  direccion: z.enum(["arriba", "abajo"]),
});

export type CrearMedioDePago = z.infer<typeof crearMedioDePago>;
export type EditarMedioDePago = z.infer<typeof editarMedioDePago>;
