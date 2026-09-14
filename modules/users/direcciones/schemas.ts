import { z } from "zod";

import { telefonoArgentino } from "@/lib/telefono";
import { PROVINCIAS } from "@/modules/users/direcciones/constantes";

/**
 * Validación de una dirección — RF-09, F5.3. Corre en el servidor, dentro
 * del envoltorio de acciones (§6.2).
 *
 * Los mensajes dicen qué escribir, no qué está mal: «Escribí la calle» y no
 * «Calle inválida».
 */

/** Texto opcional: vacío se guarda como `null`, no como una cadena vacía. */
const opcional = (max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .max(max, mensaje)
    .optional()
    .transform((v) => (v ? v : null));

const obligatorio = (vacio: string, max: number, largo: string) =>
  z.string().trim().min(1, vacio).max(max, largo);

export const direccionSchema = z.object({
  label: obligatorio(
    "Poné un nombre para reconocerla, por ejemplo «Casa».",
    30,
    "Ese nombre es demasiado largo.",
  ),
  recipientName: z
    .string()
    .trim()
    .min(2, "Escribí quién la recibe.")
    .max(80, "Ese nombre es demasiado largo."),
  phone: telefonoArgentino({
    requerido: "Necesitamos un teléfono para coordinar la entrega.",
    invalido:
      "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 2920 55 5555.",
  }),
  street: obligatorio("Escribí la calle.", 80, "Ese nombre es demasiado largo."),
  number: obligatorio(
    "Escribí la altura. Si no tiene, poné «S/N».",
    10,
    "Esa altura es demasiado larga.",
  ),
  apartment: opcional(30, "Eso es demasiado largo para un piso o departamento."),
  city: obligatorio(
    "Escribí la ciudad o localidad.",
    60,
    "Ese nombre es demasiado largo.",
  ),
  province: z.enum(PROVINCIAS, { error: "Elegí la provincia." }),
  /**
   * Los 4 números de siempre (8500) o el código completo (R8500ABC): los dos
   * son de uso corriente, y rechazar cualquiera de ellos sería rechazar un
   * dato correcto.
   */
  postalCode: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(
      z
        .string()
        .regex(
          /^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/,
          "Escribí el código postal: 4 números, como 8500.",
        ),
    ),
  notes: opcional(200, "Las referencias pueden tener hasta 200 caracteres."),
});

export type EntradaDeDireccion = z.input<typeof direccionSchema>;

export const edicionDeDireccionSchema = direccionSchema.extend({
  id: z.uuid(),
});

export const soloIdSchema = z.object({ id: z.uuid() });
