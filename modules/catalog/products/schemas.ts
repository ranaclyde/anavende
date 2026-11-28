import "server-only";

import { z } from "zod";

import { normalizeAmount, compare, isMoney, money } from "@/lib/money";
import {
  LIMITE_DE_TEXTO,
  longitudDeTexto,
  sanitizarMarkdown,
} from "@/modules/content/markdown";

// `server-only` a propósito: la validación sanitiza, y el formulario no tiene
// que poder importarla.

const nombre = z
  .string()
  .trim()
  .min(2, "El nombre necesita al menos 2 caracteres.")
  .max(120, "El nombre no puede pasar de 120 caracteres.");

/**
 * Se sanitiza en la validación, no en el handler, para que no se olvide. El
 * límite se mide después de sanitizar y sobre el texto, no sobre el Markdown.
 */
const descripcion = z
  .string()
  .default("")
  .transform(sanitizarMarkdown)
  .refine((md) => longitudDeTexto(md) <= LIMITE_DE_TEXTO, {
    message: `La descripción no puede pasar de ${LIMITE_DE_TEXTO.toLocaleString("es-AR")} caracteres.`,
  });

/** Se valida como texto: pasarlo a `number` pierde precisión (TECHNICAL-SPEC §7.1). */
const monto = (mensaje: string) =>
  z
    .string()
    .trim()
    // Acepta coma decimal y punto de miles.
    .transform(normalizeAmount)
    .refine(isMoney, { message: mensaje })
    .transform(money);

const precio = monto("Poné un precio, con hasta dos decimales.").refine(
  (v) => compare(v, "0.00") > 0,
  { message: "El precio tiene que ser mayor que cero." },
);

const descuento = monto("Poné un descuento, con hasta dos decimales.").refine(
  (v) => compare(v, "0.00") >= 0,
  { message: "El descuento no puede ser negativo." },
);

/** Vacío se guarda como `NULL`. */
const sku = z
  .string()
  .trim()
  .max(120, "El SKU no puede pasar de 120 caracteres.")
  .default("")
  .transform((v) => v || null);

const campos = {
  name: nombre,
  sku,
  description: descripcion,
  brandId: z.uuid("Elegí una marca."),
  categoryId: z.uuid("Elegí una categoría."),
  price: precio,
  // Un monto, no un porcentaje (RN-04b). `0` = sin oferta.
  discount: descuento.default("0.00"),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
};

/** RN-04b. El error va en `discount` para que el formulario lo muestre ahí. */
const reglaDelDescuento = (
  valor: { price: string; discount: string },
  ctx: z.RefinementCtx,
) => {
  // Zod corre esto aunque un campo ya haya fallado, con el texto crudo:
  // `compare` lanzaría y saldría como INTERNAL en vez de un error de tipeo.
  if (!isMoney(valor.price) || !isMoney(valor.discount)) return;

  if (compare(valor.discount, valor.price) >= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["discount"],
      message: "El descuento tiene que ser menor que el precio.",
    });
  }
};

export const crearProducto = z.object(campos).superRefine(reglaDelDescuento);

export const editarProducto = z
  .object({ id: z.uuid(), ...campos })
  .superRefine(reglaDelDescuento);

export const soloProducto = z.object({ id: z.uuid() });

export const cambioDeEstadoDeProducto = z.object({
  id: z.uuid(),
  activo: z.boolean(),
});

export const cambioDeDestacadoDeProducto = z.object({
  id: z.uuid(),
  destacado: z.boolean(),
});

export type CrearProducto = z.infer<typeof crearProducto>;
export type EditarProducto = z.infer<typeof editarProducto>;

export type CampoDeProducto = keyof typeof campos;
