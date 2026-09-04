import { z } from "zod";

/**
 * Teléfono argentino — una sola implementación, dos consumidores.
 *
 * Lo usan el alta de comprador (F1.9, RF-05) y el número de WhatsApp del
 * sitio (F2.7, RF-20). Es la misma regla: se acepta con o sin +54, con o sin
 * 9, con espacios, guiones y paréntesis, y se guarda normalizado a
 * `+549` + los diez dígitos. Lo que cambia entre uno y otro son los
 * mensajes —a la compradora se le explica para qué lo pedimos, a la
 * vendedora se le dice qué número va— y por eso entran como parámetro en
 * vez de haber dos copias de la normalización.
 *
 * Guardar SIEMPRE la misma forma no es prolijidad: es lo que permite que
 * `wa.me/<numero>` se arme concatenando (§17, `lib/whatsapp.ts`) sin que
 * cada llamada tenga que adivinar si el que guardaron trae el 9 o no.
 */
export function telefonoArgentino(mensajes: {
  requerido: string;
  invalido: string;
}) {
  return z
    .string()
    .trim()
    .min(1, mensajes.requerido)
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .refine((v) => /^(\+?54)?9?\d{10}$/.test(v), { error: mensajes.invalido })
    .transform((v) => {
      const digitos = v.replace(/\D/g, "").replace(/^54/, "").replace(/^9/, "");
      return `+549${digitos}`;
    });
}
