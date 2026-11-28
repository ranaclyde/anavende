import { z } from "zod";

// No es `server-only`: la ficha y el carrito usan el tope para no ofrecer un
// número que el servidor va a rechazar.

/** Tope por variante en el carrito, aunque haya más stock (TECHNICAL-SPEC §6.2). */
export const TOPE_POR_ITEM = 99;

const variantId = z.uuid();
const cantidad = z.number().int().min(1).max(TOPE_POR_ITEM);

export const lineaDelCarrito = z.object({ variantId, cantidad });
export const soloVariante = z.object({ variantId });
export const sinDatos = z.object({});
