import { z } from "zod";

import { hoyEnArgentina } from "@/lib/fechas";
import { comoMonto, isMoney, money } from "@/lib/money";
import { telefonoArgentino } from "@/lib/telefono";
import { problemasDeUbicacion } from "@/modules/users/direcciones/schemas";

// Sin `server-only`: el formulario usa los topes. El stock no se valida acá,
// sino en el dominio con el `UPDATE` condicional (§8.2).

export const MAXIMO_DE_RENGLONES = 50;
export const MAXIMO_DE_NOTAS = 500;

/** Acepta la coma decimal y se valida como texto, nunca como `number` (§7.1). */
const monto = z
  .string()
  .transform(comoMonto)
  .refine(isMoney, { message: "Poné un precio, con hasta dos decimales." })
  .transform(money);

const renglon = z.object({
  variantId: z.uuid(),
  cantidad: z
    .number()
    .int()
    .min(1, "La cantidad tiene que ser al menos 1.")
    .max(9999, "Esa cantidad es demasiado grande."),
  /** Cero es válido (un regalo igual mueve stock); negativo no. */
  precio: monto.refine((v) => !v.startsWith("-"), {
    message: "El precio no puede ser negativo.",
  }),
});

/**
 * Sin `.transform()` a `null`: el envoltorio tipa la entrada con la salida del
 * esquema y obligaría a mandar el campo. La cadena vacía la convierte la acción.
 */
const opcional = (max: number, mensaje: string) =>
  z.string().trim().max(max, mensaje).optional();

/** Los campos de la libreta sin `label`: es un snapshot, no una dirección guardada. */
export const direccionDeOrdenManual = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, "Escribí quién la recibe.")
    .max(80, "Ese nombre es demasiado largo."),
  phone: telefonoArgentino({
    requerido: "Escribí un teléfono para coordinar la entrega.",
    invalido:
      "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 2920 55 5555.",
  }),
  street: z
    .string()
    .trim()
    .min(1, "Escribí la calle.")
    .max(80, "Ese nombre es demasiado largo."),
  number: z
    .string()
    .trim()
    .min(1, "Escribí la altura. Si no tiene, poné «S/N».")
    .max(10, "Esa altura es demasiado larga."),
  apartment: opcional(
    30,
    "Eso es demasiado largo para un piso o departamento.",
  ),
  localidad: z.string(),
  otraLocalidad: opcional(60, "Ese nombre es demasiado largo."),
  provinciaDeOtra: z.string().optional(),
  notes: opcional(200, "Las referencias pueden tener hasta 200 caracteres."),
});

export const FORMAS_DE_ENTREGA = ["envio", "retiro"] as const;
export const ESTADOS_INICIALES = ["activa", "finalizada"] as const;

const campos = z.object({
  items: z
    .array(renglon)
    .min(1, "Agregá al menos un producto.")
    .max(MAXIMO_DE_RENGLONES, "Son demasiados renglones para una sola orden."),
  /** Sin valor por omisión: decide qué contador de stock se mueve. */
  estado: z.enum(ESTADOS_INICIALES, {
    error: "Elegí si la orden queda activa o finalizada.",
  }),
  /** Solo con `finalizada`; obligatoria y no futura lo valida el `superRefine`. */
  fechaDeVenta: z.iso.date({ error: "Elegí la fecha de la venta." }).optional(),
  cuentaId: z.uuid().optional(),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribí el nombre del comprador.")
    .max(80, "Ese nombre es demasiado largo."),
  telefono: telefonoArgentino({
    requerido: "El teléfono es obligatorio, también en las órdenes manuales.",
    invalido:
      "Ese teléfono no parece válido. Escribilo con característica, por ejemplo 2920 55 5555.",
  }),
  email: z
    .union([z.literal(""), z.email("Ese email no parece válido.")])
    .optional(),
  entrega: z.enum(FORMAS_DE_ENTREGA, {
    error: "Elegí si se envía o se retira.",
  }),
  direccion: direccionDeOrdenManual.optional(),
  notas: opcional(
    MAXIMO_DE_NOTAS,
    `Las notas pueden tener hasta ${MAXIMO_DE_NOTAS} caracteres.`,
  ),
});

/**
 * Con envío la dirección es obligatoria: una orden sin dirección se lee como
 * retiro. Con retiro se ignora aunque llegue.
 */
export const ordenManualSchema = campos.superRefine((v, ctx) => {
  if (v.estado === "finalizada") {
    if (!v.fechaDeVenta) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaDeVenta"],
        message: "Elegí la fecha de la venta.",
      });
    } else if (v.fechaDeVenta > hoyEnArgentina()) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaDeVenta"],
        message:
          "La fecha no puede ser futura. Si todavía no se entregó, cargala como activa.",
      });
    }
  }

  if (v.entrega !== "envio") return;

  if (!v.direccion) {
    ctx.addIssue({
      code: "custom",
      path: ["direccion"],
      message: "Con envío hace falta la dirección de entrega.",
    });
    return;
  }

  for (const problema of problemasDeUbicacion({
    localidad: v.direccion.localidad,
    otraLocalidad: v.direccion.otraLocalidad ?? null,
    provinciaDeOtra: v.direccion.provinciaDeOtra,
  })) {
    ctx.addIssue({
      code: "custom",
      path: ["direccion", problema.campo],
      message: problema.mensaje,
    });
  }
});

export type OrdenManualInput = z.input<typeof ordenManualSchema>;
export type OrdenManualValidada = z.output<typeof ordenManualSchema>;
