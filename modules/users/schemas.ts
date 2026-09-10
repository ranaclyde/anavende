import { z } from "zod";

import { telefonoArgentino } from "@/lib/telefono";

/**
 * Validación de identidad — se usa en el cliente y en el servidor.
 * El envoltorio de Server Actions la vuelve a correr en el servidor aunque el
 * formulario ya la haya pasado (TECHNICAL-SPEC §6.2, paso 3).
 */

/**
 * Teléfono argentino, obligatorio en las tres vías de alta (RF-05, F1.9).
 * Es el canal por el que se coordina la venta: sin él la orden no sirve.
 *
 * La normalización vive en `lib/telefono.ts` porque el número de WhatsApp
 * del sitio (RF-20) sigue exactamente la misma regla. Acá quedan los
 * mensajes, que son lo único distinto: los lee quien se está registrando.
 */
export const telefono = telefonoArgentino({
  requerido: "Necesitamos tu teléfono para coordinar la entrega.",
  invalido:
    "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 11 5555 5555.",
});

/**
 * Nombre y apellido son DOS campos — decisión del 2026-09-10.
 *
 * Con un campo libre no hay forma de saber cuál es cuál, y hacía falta
 * saberlo: los emails saludan por el nombre de pila. Antes se adivinaba
 * partiendo por el primer espacio, y con «Sanhueza, Matías» el saludo salía
 * «Hola, Sanhueza,».
 *
 * El apellido NO se valida como una sola palabra: dos apellidos son normales
 * y validar de más convierte un dato correcto en un error.
 */
export const nombre = z
  .string()
  .trim()
  .min(2, "Escribí tu nombre.")
  .max(60, "Ese nombre es demasiado largo.");

export const apellido = z
  .string()
  .trim()
  .min(2, "Escribí tu apellido.")
  .max(60, "Ese apellido es demasiado largo.");

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
  firstName: nombre,
  lastName: apellido,
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
  firstName: nombre,
  lastName: apellido,
  phone: telefono,
});
