import "server-only";

import { z } from "zod";

import { compare, isMoney, money } from "@/lib/money";
import {
  LIMITE_DE_TEXTO,
  longitudDeTexto,
  sanitizarMarkdown,
} from "@/modules/content/markdown";

/**
 * Validación de productos — RF-15, RN-04b, §16.
 *
 * Este módulo es `server-only` a propósito, y es la diferencia con
 * `modules/catalog/schemas.ts`: acá la validación **sanitiza**, y el
 * sanitizador es del servidor. Que el formulario no pueda importarlo es la
 * garantía de que nadie confunda «el editor ya lo limpió» con «está limpio».
 */

const nombre = z
  .string()
  .trim()
  .min(2, "El nombre necesita al menos 2 caracteres.")
  // Más largo que el de marcas y categorías (60): el nombre de un producto
  // lleva modelo y característica —«Teclado mecánico K120 retroiluminado»— y
  // a 60 se corta justo donde deja de distinguirse de otro.
  .max(120, "El nombre no puede pasar de 120 caracteres.");

/**
 * La descripción se SANITIZA como parte de la validación, no después: si
 * fuera un paso aparte en el handler, sería un paso que un día se olvida
 * (§16). Lo que sale de acá ya es Markdown de la lista blanca.
 *
 * El límite se mide DESPUÉS de sanitizar y sobre el texto, no sobre el
 * Markdown: pegar una tabla enorme que se descarta entera no puede dejar el
 * producto pasado de largo por un texto que ya no existe.
 */
const descripcion = z
  .string()
  // RF-15: «Una descripción vacía es válida: no todo producto necesita una».
  .default("")
  .transform(sanitizarMarkdown)
  .refine((md) => longitudDeTexto(md) <= LIMITE_DE_TEXTO, {
    message: `La descripción no puede pasar de ${LIMITE_DE_TEXTO.toLocaleString("es-AR")} caracteres.`,
  });

/**
 * Un monto llega del formulario como TEXTO y se valida como texto (§7.1).
 * Convertirlo a `number` para revisarlo pierde precisión justo en el paso
 * que existe para no perderla.
 */
const monto = (mensaje: string) =>
  z
    .string()
    .trim()
    // Una coma decimal es lo que escribe cualquiera en Argentina, y
    // rechazarla sería pedirle a la vendedora que escriba como la base.
    .transform((v) => v.replace(",", "."))
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

const campos = {
  name: nombre,
  description: descripcion,
  brandId: z.uuid("Elegí una marca."),
  categoryId: z.uuid("Elegí una categoría."),
  price: precio,
  // RN-04b: el descuento es un MONTO, no un porcentaje. `0` = sin oferta.
  discount: descuento.default("0.00"),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
};

/**
 * RN-04b, la regla que necesita los dos campos a la vez: el descuento nunca
 * puede dejar el precio final en cero ni en negativo.
 *
 * El error se cuelga de `discount` y no del objeto: el formulario lo muestra
 * debajo del campo que hay que corregir, que es el descuento — el precio
 * está bien, es el descuento el que no entra. Un cartel suelto arriba
 * obligaría a adivinar cuál de los dos tocar.
 */
const reglaDelDescuento = (
  valor: { price: string; discount: string },
  ctx: z.RefinementCtx,
) => {
  // La comprobación de objeto corre AUNQUE un campo ya haya fallado, y ahí
  // `price` todavía es lo que escribió la vendedora —«diez mil»— y no un
  // monto. `compare` lanza sobre eso, y una excepción adentro de la
  // validación sale como INTERNAL: un error de tipeo terminaría reportado a
  // Sentry como un incidente. Si el monto no está bien formado, su propio
  // mensaje ya alcanza.
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

/** Los campos que el formulario puede marcar en rojo. */
export type CampoDeProducto = keyof typeof campos;
