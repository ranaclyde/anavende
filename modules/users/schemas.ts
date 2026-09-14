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

/**
 * A dónde vuelve quien se está dando de alta, para que el enlace del email lo
 * devuelva ahí y no a «Mi cuenta» — F5.7, RF-08.
 *
 * **Se limpia en vez de rechazarse.** Un destino con host convertiría el
 * enlace de un email nuestro en un redirector abierto, y `//otro.com` es un
 * host aunque empiece con barra. Pero fallar la validación frenaría un alta
 * legítima por un parámetro que la persona no escribió ni ve: lo que
 * corresponde es tirar el destino raro y seguir, que es lo que hace
 * `/api/auth/confirmar` con lo que le llega.
 */
export const rutaDeRegreso = z
  .string()
  .transform((v) => (v.startsWith("/") && !v.startsWith("//") ? v : undefined))
  .optional();

export const registroSchema = z.object({
  firstName: nombre,
  lastName: apellido,
  email,
  phone: telefono,
  password: contrasena,
  volver: rutaDeRegreso,
});
export type EntradaRegistro = z.input<typeof registroSchema>;

export const ingresoSchema = z.object({
  email,
  password: z.string().min(1, "Escribí tu contraseña."),
});

export const reenvioSchema = z.object({ email, volver: rutaDeRegreso });

/** Se completa tras el primer ingreso por Google o Facebook (RF-06). */
export const completarPerfilSchema = z.object({
  firstName: nombre,
  lastName: apellido,
  phone: telefono,
});

/**
 * «Mis datos» (RF-07, F5.2): los mismos tres campos, con las mismas reglas.
 * El teléfono sigue sin poder quedar vacío (RF-05). El email no se edita —ver
 * `modules/users/perfil.ts`—, y como el objeto descarta lo que no declara,
 * mandarlo igual no lo cambia.
 */
export const misDatosSchema = completarPerfilSchema;

/**
 * Cambiar o definir la contraseña (RF-07, RF-06).
 *
 * La actual es opcional ACÁ porque quien entró solo por Google o Facebook no
 * tiene una; que haga falta lo decide la acción con la sesión en la mano.
 */
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
