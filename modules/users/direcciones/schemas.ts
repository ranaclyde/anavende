import { z } from "zod";

import { argentinePhone } from "@/lib/phone";
import {
  LOCALIDADES,
  OTRA_LOCALIDAD,
  PROVINCIAS_DE_LA_ZONA,
} from "@/modules/users/direcciones/constantes";
import type { DatosDeDireccion } from "@/modules/users/direcciones/operaciones";

/** Vacío se guarda como `null`, no como una cadena vacía. */
const opcional = (max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .max(max, mensaje)
    .optional()
    .transform((v) => (v ? v : null));

const obligatorio = (vacio: string, max: number, largo: string) =>
  z.string().trim().min(1, vacio).max(max, largo);

const campos = z.object({
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
  phone: argentinePhone({
    required: "Necesitamos un teléfono para coordinar la entrega.",
    invalid:
      "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 2920 55 5555.",
  }),
  street: obligatorio(
    "Escribí la calle.",
    80,
    "Ese nombre es demasiado largo.",
  ),
  number: obligatorio(
    "Escribí la altura. Si no tiene, poné «S/N».",
    10,
    "Esa altura es demasiado larga.",
  ),
  apartment: opcional(
    30,
    "Eso es demasiado largo para un piso o departamento.",
  ),
  localidad: z.string(),
  otraLocalidad: opcional(60, "Ese nombre es demasiado largo."),
  provinciaDeOtra: z.string().optional(),
  notes: opcional(200, "Las referencias pueden tener hasta 200 caracteres."),
});

export type Ubicacion = {
  localidad: string;
  otraLocalidad: string | null;
  provinciaDeOtra?: string;
};

/** La usan el alta, la edición y la dirección de una orden manual (RF-24). */
export function problemasDeUbicacion(v: Ubicacion) {
  const problemas: { campo: keyof Ubicacion; mensaje: string }[] = [];

  if (v.localidad === OTRA_LOCALIDAD) {
    if (!v.otraLocalidad) {
      problemas.push({
        campo: "otraLocalidad",
        mensaje: "Escribí el nombre de la localidad.",
      });
    }
    if (!PROVINCIAS_DE_LA_ZONA.some((p) => p === v.provinciaDeOtra)) {
      problemas.push({
        campo: "provinciaDeOtra",
        mensaje: "Elegí la provincia.",
      });
    }
  } else if (!LOCALIDADES.some((l) => l.nombre === v.localidad)) {
    problemas.push({ campo: "localidad", mensaje: "Elegí la localidad." });
  }

  return problemas;
}

export const direccionSchema = campos.superRefine((v, ctx) => {
  for (const p of problemasDeUbicacion(v)) {
    ctx.addIssue({ code: "custom", path: [p.campo], message: p.mensaje });
  }
});

// Aparte y no `direccionSchema.extend(…)`: zod 4 no deja extender un objeto
// que ya tiene un refinamiento.
export const edicionDeDireccionSchema = campos
  .extend({ id: z.uuid() })
  .superRefine((v, ctx) => {
    for (const p of problemasDeUbicacion(v)) {
      ctx.addIssue({ code: "custom", path: [p.campo], message: p.mensaje });
    }
  });

export const soloIdSchema = z.object({ id: z.uuid() });

export function aDatosDeDireccion(
  v: z.output<typeof campos>,
): DatosDeDireccion {
  return {
    label: v.label,
    recipientName: v.recipientName,
    phone: v.phone,
    street: v.street,
    number: v.number,
    apartment: v.apartment,
    notes: v.notes,
    ...ubicacionGuardada(v),
  };
}

/** Aparte porque la orden manual la usa para su snapshot (RF-24). */
export function ubicacionGuardada(v: Ubicacion): {
  city: string;
  province: string;
  postalCode: string | null;
} {
  const conocida = LOCALIDADES.find((l) => l.nombre === v.localidad);

  return conocida
    ? {
        city: conocida.nombre,
        province: conocida.provincia,
        postalCode: conocida.codigoPostal,
      }
    : {
        city: v.otraLocalidad ?? "",
        province: v.provinciaDeOtra ?? "",
        postalCode: null,
      };
}
