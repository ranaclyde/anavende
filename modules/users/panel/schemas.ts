import { z } from "zod";

import { telefonoArgentino } from "@/lib/telefono";

/**
 * Validación de la gestión de usuarios del panel — FS RF-26. Tarea F7.6.
 *
 * **Mensajes propios y no los de `modules/users/schemas.ts`**, aunque las
 * reglas sean las mismas: aquéllos le hablan a quien se está registrando —«
 * Escribí tu nombre»— y acá la vendedora está cargando a otra persona. Es el
 * mismo criterio que tomó la orden manual de F7.4.
 *
 * No es `server-only`: los formularios validan con esto antes de enviar.
 */

export const ROLES_ASIGNABLES = [
  {
    valor: "customer",
    etiqueta: "Comprador",
    ayuda: "Compra en la tienda y ve sus propias compras.",
  },
  {
    valor: "admin",
    etiqueta: "Administradora",
    ayuda: "Entra al panel: catálogo, órdenes, devoluciones y usuarios.",
  },
] as const;

export type RolAsignable = (typeof ROLES_ASIGNABLES)[number]["valor"];

const rol = z.enum(["customer", "admin"], "Elegí un rol.");

const nombre = z
  .string()
  .trim()
  .min(2, "Escribí el nombre.")
  .max(60, "Ese nombre es demasiado largo.");

/** Dos apellidos son normales: no se valida como una sola palabra. */
const apellido = z
  .string()
  .trim()
  .min(2, "Escribí el apellido.")
  .max(60, "Ese apellido es demasiado largo.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Ese email no parece válido."));

/**
 * **El teléfono es obligatorio también acá** (decisión tuya del 2026-09-16).
 *
 * RF-26 nombra «nombre, email y rol», pero RF-05 lo pide en las tres vías de
 * alta y la columna es `NOT NULL`: una cuenta sin teléfono es una persona con
 * la que no se puede coordinar una entrega, que es como se coordina todo acá.
 * Dejarlo vacío habría sido guardar una cadena vacía, que es un dato que
 * miente.
 */
const telefono = telefonoArgentino({
  requerido: "Escribí un teléfono para poder coordinar.",
  invalido:
    "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 11 5555 5555.",
});

export const altaDeUsuario = z.object({
  firstName: nombre,
  lastName: apellido,
  email,
  phone: telefono,
  rol,
});

export type EntradaDeAlta = z.input<typeof altaDeUsuario>;

/**
 * **El email no se edita**, igual que en «Mis datos» (F5.2): lo guarda GoTrue,
 * cambiarlo exige confirmar la dirección nueva con un email que RF-30 no
 * tiene, y la copia de `user_profiles` quedaría desincronizada.
 */
export const edicionDeUsuario = z.object({
  id: z.uuid(),
  firstName: nombre,
  lastName: apellido,
  phone: telefono,
});

export const cambioDeRol = z.object({
  id: z.uuid(),
  rol,
});

export const restablecerContrasena = z.object({ id: z.uuid() });

/**
 * Bloqueo y desbloqueo — RF-27. Tarea F7.7.
 *
 * **El motivo es obligatorio y no es una nota interna**: es el texto que la
 * persona lee cuando intenta entrar (§13.5). Por eso el mensaje de error habla
 * de eso y no de un campo incompleto.
 *
 * El tope es el mismo que el del pedido de baja (F5.8): alcanza para
 * explicarse y no invita a pegar un documento.
 */
export const MAXIMO_DEL_MOTIVO = 500;

export const bloqueoDeUsuario = z.object({
  id: z.uuid(),
  motivo: z
    .string()
    .trim()
    .min(1, "Escribí el motivo: es lo que va a leer al intentar entrar.")
    .max(MAXIMO_DEL_MOTIVO, `Hasta ${MAXIMO_DEL_MOTIVO} caracteres.`),
});

export const desbloqueoDeUsuario = z.object({ id: z.uuid() });

/**
 * Ejecutar y revertir una baja — RF-34. Tarea F7.9.
 *
 * **Sin motivo, ni en una ni en otra.** El de la baja lo escribió el comprador
 * al pedirla (F5.8) y es el que queda registrado: la administradora ejecuta lo
 * pedido, no lo redacta. Y revertir es devolverle la cuenta a alguien que la
 * quiere de vuelta, que tampoco necesita explicación escrita.
 */
export const bajaDeUsuario = z.object({ id: z.uuid() });
