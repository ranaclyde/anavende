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
  .min(
    0,
    "El stock no puede ser negativo. Se ajusta con una venta o una devolución, no a mano.",
  )
  // Un tope alto que igual atrapa el resbalón de teclado —pegar el precio en
  // el campo del stock— antes de que quede guardado como si fuera cierto.
  .max(1_000_000, "Ese número es demasiado grande. Revisalo.");

/** `null` = variante única: el producto no se vende por color (RF-16). */
const colorId = z.uuid("Elegí un color.").nullable();

/**
 * El segundo color de una variante de dos («Negro/Rojo»). `null` = de un solo
 * color. Opcional en la entrada para que quien no lo conoce —el alta manual
 * de una orden, los tests viejos— siga mandando lo mismo de siempre.
 */
const secondaryColorId = z
  .uuid("Elegí el segundo color.")
  .nullable()
  .default(null);

/**
 * Lo mismo que el CHECK `secondary_color_valid`, dicho antes de llegar a la
 * base y con una frase: sin primer color no hay segundo, y no se repite.
 */
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
 * Reponer desde el listado — el globo de «Reponer» de `/admin/productos`.
 *
 * Manda **todas** las variantes del producto y no solo las que cambiaron: la
 * vendedora abre el globo, corrige los números que quiere y guarda una vez.
 * Filtrar acá cuáles cambiaron sería adivinar contra una foto vieja; del lado
 * del servidor `ajustar()` ya no asienta un movimiento cuando la diferencia
 * es cero, así que mandar de más no ensucia el libro.
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
  ids: z.array(z.uuid()).min(1).max(MAXIMO_POR_VARIANTE),
});

export const soloImagen = z.object({ id: z.uuid() });

export type CrearVariante = z.infer<typeof crearVariante>;
export type EditarVariante = z.infer<typeof editarVariante>;
