import { z } from "zod";

import { internalRedirectTarget } from "@/lib/redirect-target";
import { argentinePhone } from "@/lib/phone";

export const telefono = argentinePhone({
  required: "Necesitamos tu teléfono para coordinar la entrega.",
  invalid:
    "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 11 5555 5555.",
});

/** El apellido no se valida como una sola palabra: hay dos apellidos. */
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

export const contrasena = z
  .string()
  .min(8, "La contraseña tiene que tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede pasar de 72 caracteres.");

/**
 * Se limpia en vez de rechazarse: un destino con host (`//otro.com` también)
 * haría del email un redirector abierto, pero rechazarlo frenaría un alta
 * legítima por un parámetro que la persona no ve.
 */
export const rutaDeRegreso = z
  .string()
  .transform(internalRedirectTarget)
  .optional();

/**
 * Turnstile: lo valida GoTrue, acá solo se acota. Opcional porque sin
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no hay widget y GoTrue no lo pide.
 */
const captcha = z.string().trim().max(4096).optional();

export const registroSchema = z.object({
  firstName: nombre,
  lastName: apellido,
  email,
  phone: telefono,
  password: contrasena,
  volver: rutaDeRegreso,
  captcha,
});
export type EntradaRegistro = z.input<typeof registroSchema>;

export const ingresoSchema = z.object({
  email,
  password: z.string().min(1, "Escribí tu contraseña."),
  captcha,
});

export const reenvioSchema = z.object({
  email,
  volver: rutaDeRegreso,
  captcha,
});

export const recuperacionSchema = z.object({ email, captcha });

export const completarPerfilSchema = z.object({
  firstName: nombre,
  lastName: apellido,
  phone: telefono,
});

/** El email no se edita: el objeto descarta lo que no declara. */
export const misDatosSchema = completarPerfilSchema;

/**
 * La actual es opcional acá porque quien entró solo por Google no tiene una;
 * que haga falta lo decide la acción, con la sesión.
 */
export const definicionDeContrasenaSchema = z
  .object({
    nueva: contrasena,
    repetida: z.string(),
  })
  .refine((v) => v.nueva === v.repetida, {
    path: ["repetida"],
    error: "Las dos contraseñas tienen que ser iguales.",
  });

export const cambioDeContrasenaSchema = z
  .object({
    actual: z.string().max(72).optional(),
    nueva: contrasena,
    repetida: z.string(),
  })
  .refine((v) => v.nueva === v.repetida, {
    path: ["repetida"],
    error: "Las dos contraseñas tienen que ser iguales.",
  });
