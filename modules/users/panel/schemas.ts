import { z } from "zod";

import { argentinePhone } from "@/lib/phone";

/**
 * Mensajes propios y no los de `modules/users/schemas.ts`: aquéllos le hablan
 * a quien se registra, y acá la vendedora carga a otra persona.
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

const telefono = argentinePhone({
  required: "Escribí un teléfono para poder coordinar.",
  invalid:
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

/** El email no se edita, igual que en «Mis datos» (ver `perfil.ts`). */
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

/** No es una nota interna: es lo que la persona lee al entrar (§13.5). */
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

/** Sin motivo: el de la baja lo escribió el comprador al pedirla. */
export const bajaDeUsuario = z.object({ id: z.uuid() });
