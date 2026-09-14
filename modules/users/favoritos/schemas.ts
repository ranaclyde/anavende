import { z } from "zod";

/**
 * Validación de favoritos — RF-10 · TECHNICAL-SPEC §6.2, paso 3. Tarea F5.4.
 *
 * **Se dice si queda marcado o no, y no «alternar».** Un «alternar» con doble
 * clic o con dos pestañas abiertas termina al revés de lo que la persona ve;
 * «dejalo marcado» repetido dos veces sigue dejándolo marcado.
 */

const productId = z.uuid();

export const cambioDeFavorito = z.object({
  productId,
  marcado: z.boolean(),
});

export const soloProducto = z.object({ productId });

export const sinDatos = z.object({});
