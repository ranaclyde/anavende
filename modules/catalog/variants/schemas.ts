import { z } from "zod";

import { MAXIMO_POR_VARIANTE } from "@/modules/media/tamanos";

// No es `server-only`: el formulario lo usa para avisar antes de enviar.

/**
 * A mano no puede ser negativo aunque la columna lo admita: el negativo lo
 * produce una venta (RF-24), no un campo de formulario.
 */
const stock = z
  .number({ error: "Poné cuántas unidades hay, en números enteros." })
  .int("El stock se cuenta en unidades enteras.")
  .min(
    0,
    "El stock no puede ser negativo. Se ajusta con una venta o una devolución, no a mano.",
  )
  // Atrapa pegar el precio en el campo del stock.
  .max(1_000_000, "Ese número es demasiado grande. Revisalo.");

/** `null` = variante única: el producto no se vende por color (RF-16). */
const colorId = z.uuid("Elegí un color.").nullable();

/** `null` = de un solo color. Opcional para quien no lo manda. */
const secondaryColorId = z
  .uuid("Elegí el segundo color.")
  .nullable()
  .default(null);

/** Lo mismo que el CHECK `secondary_color_valid`, con un mensaje. */
function segundoValido<
  T extends { colorId: string | null; secondaryColorId: string | null },
>(v: T, ctx: z.RefinementCtx) {
  if (!v.secondaryColorId) return;
  if (!v.colorId) {
    ctx.addIssue({
      code: "custom",
      path: ["secondaryColorId"],
      message: "Elegí primero un color. «Único» no lleva segundo color.",
    });
  } else if (v.secondaryColorId === v.colorId) {
    ctx.addIssue({
      code: "custom",
      path: ["secondaryColorId"],
      message: "El segundo color tiene que ser distinto del primero.",
    });
  }
}

export const crearVariante = z
  .object({
    productId: z.uuid(),
    colorId,
    secondaryColorId,
    stockTotal: stock,
    isActive: z.boolean().default(true),
  })
  .superRefine(segundoValido);

export const editarVariante = z
  .object({
    id: z.uuid(),
    colorId,
    secondaryColorId,
    stockTotal: stock,
    isActive: z.boolean().default(true),
  })
  .superRefine(segundoValido);

export const soloVariante = z.object({ id: z.uuid() });

export const soloProducto = z.object({ productId: z.uuid() });

/**
 * Manda todas las variantes, no solo las que cambiaron: `ajustar()` no asienta
 * movimiento cuando la diferencia es cero.
 */
export const reposicion = z.object({
  productId: z.uuid(),
  ajustes: z
    .array(z.object({ variantId: z.uuid(), nuevoTotal: stock }))
    .min(1, "No hay ningún color al que ponerle stock.")
    .max(50),
});

export const cambioDeEstadoDeVariante = z.object({
  id: z.uuid(),
  activo: z.boolean(),
});

/** `sourceId: null` = volver a las imágenes propias. */
export const fuenteDeImagenes = z.object({
  id: z.uuid(),
  sourceId: z.uuid().nullable(),
});

/** El orden completo, no un movimiento: si no coincide con la base, se rechaza. */
export const ordenDeImagenes = z.object({
  variantId: z.uuid(),
  ids: z.array(z.uuid()).min(1).max(MAXIMO_POR_VARIANTE),
});

export const soloImagen = z.object({ id: z.uuid() });

export type CrearVariante = z.infer<typeof crearVariante>;
export type EditarVariante = z.infer<typeof editarVariante>;
