import { z } from "zod";

/**
 * Se dice si queda marcado, y no «alternar»: con doble clic o dos pestañas, un
 * «alternar» termina al revés de lo que la persona ve.
 */

const productId = z.uuid();

export const cambioDeFavorito = z.object({
  productId,
  marcado: z.boolean(),
});

export const soloProducto = z.object({ productId });

export const sinDatos = z.object({});

export const vistaDeFavoritos = z.enum(["lista", "tarjetas"]);
export type VistaDeFavoritos = z.infer<typeof vistaDeFavoritos>;

export const eleccionDeVista = z.object({ vista: vistaDeFavoritos });
