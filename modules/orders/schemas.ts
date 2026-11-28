import { z } from "zod";

import { isMoney } from "@/lib/money";
import { argentinePhone } from "@/lib/phone";

export const FORMAS_DE_ENTREGA = ["envio", "retiro"] as const;

export const confirmacionSchema = z
  .object({
    /** La genera la página al abrirse: un reintento trae la misma (§8.5). */
    idempotencyKey: z.uuid(),
    // Nombre y teléfono van al snapshot de la orden y no tocan la cuenta.
    nombre: z
      .string()
      .trim()
      .min(2, "Escribí tu nombre.")
      .max(80, "Ese nombre es demasiado largo."),
    telefono: argentinePhone({
      required: "Necesitamos tu teléfono para coordinar la entrega.",
      invalid:
        "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 2920 55 5555.",
    }),
    entrega: z.enum(FORMAS_DE_ENTREGA, {
      error: "Elegí si te lo enviamos o lo retirás.",
    }),
    /** Solo con envío. Con retiro se ignora aunque llegue. */
    addressId: z.uuid().optional(),
    /** Lo que el comprador vio en el resumen; si no coincide, reconfirma (§8.4). */
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
