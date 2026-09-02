import { z } from "zod";

/**
 * Validación de identidad — se usa en el cliente y en el servidor.
 * El envoltorio de Server Actions la vuelve a correr en el servidor aunque el
 * formulario ya la haya pasado (TECHNICAL-SPEC §6.2, paso 3).
 */

/**
 * Teléfono argentino, obligatorio en las tres vías de alta (RF-05, F1.9).
 * Es el canal por el que se coordina la venta: sin él la orden no sirve.
 * Se acepta con o sin +54, con o sin 9, con espacios y guiones, y se guarda
 * normalizado a solo dígitos con el prefijo internacional.
 */
export const telefono = z
  .string()
  .trim()
  .min(1, "Necesitamos tu teléfono para coordinar la entrega.")
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .refine((v) => /^(\+?54)?9?\d{10}$/.test(v.replace(/^\+/, "+")), {
    error:
      "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 11 5555 5555.",
  })
  .transform((v) => {
    const digitos = v.replace(/\D/g, "").replace(/^54/, "").replace(/^9/, "");
    return `+549${digitos}`;
  });

export const nombreCompleto = z
  .string()
  .trim()
  .min(2, "Escribí tu nombre y apellido.")
  .max(120, "Ese nombre es demasiado largo.");

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Ese email no parece válido."));

/** RF-05: los requisitos se muestran ANTES de enviar el formulario. */
export const contrasena = z
  .string()
  .min(8, "La contraseña tiene que tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede pasar de 72 caracteres.");

export const registroSchema = z.object({
  fullName: nombreCompleto,
  email,
  phone: telefono,
  password: contrasena,
});
export type EntradaRegistro = z.input<typeof registroSchema>;

export const ingresoSchema = z.object({
  email,
  password: z.string().min(1, "Escribí tu contraseña."),
});

export const reenvioSchema = z.object({ email });

/** Se completa tras el primer ingreso por Google o Facebook (RF-06). */
export const completarPerfilSchema = z.object({
  fullName: nombreCompleto,
  phone: telefono,
});
