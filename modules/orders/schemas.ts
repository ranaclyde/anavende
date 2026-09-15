import { z } from "zod";

import { isMoney } from "@/lib/money";
import { telefonoArgentino } from "@/lib/telefono";

/**
 * Validación de la confirmación del pedido — FS RF-11 · TS §8.4, §8.5.
 * Tarea F6.1. Corre en el servidor, dentro del envoltorio de acciones (§6.2).
 */

export const FORMAS_DE_ENTREGA = ["envio", "retiro"] as const;

export const confirmacionSchema = z
  .object({
    /** La generó la página al abrirse (§8.5): un reintento trae la misma. */
    idempotencyKey: z.uuid(),
    // Nombre y teléfono son los de ESTE pedido: van al snapshot de la orden
    // (RN-12) y no tocan la cuenta.
    nombre: z
      .string()
      .trim()
      .min(2, "Escribí tu nombre.")
      .max(80, "Ese nombre es demasiado largo."),
    telefono: telefonoArgentino({
      requerido: "Necesitamos tu teléfono para coordinar la entrega.",
      invalido:
        "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 2920 55 5555.",
    }),
    entrega: z.enum(FORMAS_DE_ENTREGA, {
      error: "Elegí si te lo enviamos o lo retirás.",
    }),
    /** Solo con envío. Con retiro se ignora aunque llegue. */
    addressId: z.uuid().optional(),
    /**
     * Lo que el comprador vio en el resumen (§8.4 paso 3). Si no coincide con
     * lo vigente, la orden no se crea y se le pide que reconfirme. La cantidad
     * va porque también cambia el total (F6.2).
     */
    esperado: z
      .array(
        z.object({
          variantId: z.uuid(),
          unitPrice: z.string().refine(isMoney),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(200),
  })
  .superRefine((v, ctx) => {
    if (v.entrega === "envio" && !v.addressId) {
      ctx.addIssue({
        code: "custom",
        path: ["addressId"],
        message: "Elegí a dónde te lo enviamos.",
      });
    }
  });

export type Confirmacion = z.output<typeof confirmacionSchema>;
