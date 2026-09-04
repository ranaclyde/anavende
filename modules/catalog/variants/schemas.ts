import { z } from "zod";

import { MAXIMO_POR_VARIANTE } from "@/modules/media/tamanos";

/**
 * Validación de variantes de color — RF-16, RN-11b, §5.4.
 *
 * A diferencia de `products/schemas.ts`, este módulo NO es `server-only`: no
 * sanitiza nada, y el formulario necesita el tope de imágenes y el máximo de
 * stock para poder avisar antes de enviar.
 */

/**
 * El stock que se escribe a mano NO PUEDE SER NEGATIVO, aunque la columna sí
 * lo admita.
 *
 * No es una contradicción con §5.4: ahí el total negativo es la SEÑAL de que
 * se vendió más de lo que el sistema creía —una venta ya ocurrida que RF-24
 * deja registrar igual—, y eso lo produce una operación de stock, no un campo
 * de formulario. Escribir «-3» a mano no registra ninguna discrepancia: es un
 * error de tipeo que después hay que perseguir.
 */
const stock = z
  .number({ error: "Poné cuántas unidades hay, en números enteros." })
  .int("El stock se cuenta en unidades enteras.")
  .min(0, "El stock no puede ser negativo. Se ajusta con una venta o una devolución, no a mano.")
  // Un tope alto que igual atrapa el resbalón de teclado —pegar el precio en
  // el campo del stock— antes de que quede guardado como si fuera cierto.
  .max(1_000_000, "Ese número es demasiado grande. Revisalo.");

/** `null` = variante única: el producto no se vende por color (RF-16). */
const colorId = z.uuid("Elegí un color.").nullable();

export const crearVariante = z.object({
  productId: z.uuid(),
  colorId,
  stockTotal: stock,
  isActive: z.boolean().default(true),
});

export const editarVariante = z.object({
  id: z.uuid(),
  colorId,
  stockTotal: stock,
  isActive: z.boolean().default(true),
});

export const soloVariante = z.object({ id: z.uuid() });

export const cambioDeEstadoDeVariante = z.object({
  id: z.uuid(),
  activo: z.boolean(),
});

/**
 * Reutilizar las imágenes de otra variante — RF-16, §9.5.
 * `sourceId: null` = dejar de reutilizarlas y volver a las propias.
 */
export const fuenteDeImagenes = z.object({
  id: z.uuid(),
  sourceId: z.uuid().nullable(),
});

/**
 * El orden COMPLETO de las imágenes de una variante, no un movimiento
 * (RF-17). La lista de abajo es la que se va a escribir tal cual: si no
 * coincide con lo que hay en la base, la acción la rechaza entera.
 */
export const ordenDeImagenes = z.object({
  variantId: z.uuid(),
  ids: z
    .array(z.uuid())
    .min(1)
    .max(MAXIMO_POR_VARIANTE),
});

export const soloImagen = z.object({ id: z.uuid() });

export type CrearVariante = z.infer<typeof crearVariante>;
export type EditarVariante = z.infer<typeof editarVariante>;
