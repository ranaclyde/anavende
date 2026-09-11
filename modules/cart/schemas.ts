import { z } from "zod";

/**
 * Validación del carrito — RF-08 · TECHNICAL-SPEC §6.2, paso 3.
 *
 * No es `server-only`: la ficha y el carrito usan el tope para no ofrecer un
 * número que el servidor va a rechazar. Quien decide sigue siendo el
 * servidor, que vuelve a correr estos esquemas en el envoltorio.
 */

/**
 * Cuántas unidades de una misma variante entran en el carrito, aunque haya
 * más stock. Es el 99 del ejemplo de §6.2: una tienda chica no vende cien
 * teclados iguales a una persona por la web, y sin tope un campo numérico
 * acepta lo que se tipee.
 */
export const TOPE_POR_ITEM = 99;

const variantId = z.uuid();
const cantidad = z.number().int().min(1).max(TOPE_POR_ITEM);

export const lineaDelCarrito = z.object({ variantId, cantidad });
export const soloVariante = z.object({ variantId });
export const sinDatos = z.object({});
