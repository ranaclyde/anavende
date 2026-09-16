import { z } from "zod";

import { comoMonto, isMoney, money } from "@/lib/money";
import { telefonoArgentino } from "@/lib/telefono";
import { problemasDeUbicacion } from "@/modules/users/direcciones/schemas";

/**
 * Validación del alta de una orden manual — FS RF-24. Tarea F7.4.
 *
 * No es `server-only`: el formulario usa los topes para limitar los campos,
 * como ya hacen la baja de cuenta (F5.8) y el motivo de la cancelación (F7.3).
 *
 * **Lo que esta validación NO decide:** si hay stock. Eso lo resuelve el
 * dominio con el `UPDATE` condicional (§8.2), porque entre que la pantalla se
 * pintó y llegó el envío el stock pudo cambiar. Acá sólo se mira la forma.
 */

/** Una orden cargada a mano; más que esto es un remito, no una venta. */
export const MAXIMO_DE_RENGLONES = 50;
export const MAXIMO_DE_NOTAS = 500;

/**
 * Un monto escrito por la vendedora — mismo criterio que el precio de un
 * producto (`modules/catalog/products/schemas.ts`): se acepta la coma decimal
 * que escribe cualquiera en Argentina y se valida como texto, nunca como
 * `number`, que es donde se pierden los centavos (§7.1).
 */
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
  /**
   * **Cero es válido**: RF-24 habla de precios acordados, y el cable que va
   * de regalo con el teclado es una venta a $0 que igual mueve stock. Lo que
   * no se admite es negativo — eso no es un descuento, es otra cosa, y el
   * `CHECK total_not_negative` de la orden tampoco lo dejaría pasar.
   */
  precio: monto.refine((v) => !v.startsWith("-"), {
    message: "El precio no puede ser negativo.",
  }),
});

/**
 * Texto que puede no venir.
 *
 * **Sin `.transform()` a `null`**, aunque sea `null` lo que hay que guardar:
 * el envoltorio tipa la entrada con la *salida* del esquema, así que una
 * transformación acá obligaría a quien llama a mandar el campo igual —lo
 * mismo que F7.3 aprendió con el motivo de la cancelación, y que F7.2 había
 * aprendido con `default(false)`—. La cadena vacía se convierte en la acción,
 * que es donde se escribe la fila.
 */
const opcional = (max: number, mensaje: string) =>
  z.string().trim().max(max, mensaje).optional();

/**
 * La dirección de una orden manual.
 *
 * **Son los mismos campos de la libreta menos la etiqueta** (`label`): eso
 * existe para reconocer una dirección guardada entre otras, y ésta no se
 * guarda en ninguna libreta — es el snapshot de a dónde fue este pedido. La
 * localidad se valida con la regla de RN-10, que vive en el módulo de
 * direcciones y se importa en vez de copiarse.
 */
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
  /**
   * **Finalizada por omisión no se decide acá** sino en el formulario: este
   * esquema exige que venga elegido, porque de esto depende qué contador de
   * stock se mueve y no hay un valor seguro para adivinar (§8.1).
   */
  estado: z.enum(ESTADOS_INICIALES, {
    error: "Elegí si la orden queda activa o finalizada.",
  }),
  /** La cuenta del comprador, si se la asoció (RF-24). */
  cuentaId: z.uuid().optional(),
  // El snapshot del pedido, de texto libre: RF-24 pide justamente que se
  // pueda cargar una venta de alguien que no tiene cuenta.
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
 * **Con envío, la dirección es obligatoria** — RF-24 lo subraya, y §5.6
 * explica por qué no alcanza con confiar: la orden no tiene columna de forma
 * de entrega, así que *una orden sin dirección se lee como retiro*. Guardar
 * un envío sin dirección no dejaría un dato faltante, dejaría una orden que
 * miente sobre lo que hay que hacer con ella.
 *
 * Con retiro la dirección se ignora aunque llegue: el formulario la deja
 * escrita mientras se cambia de opinión, y lo que decide es la elección.
 */
export const ordenManualSchema = campos.superRefine((v, ctx) => {
  if (v.entrega !== "envio") return;

  if (!v.direccion) {
    ctx.addIssue({
      code: "custom",
      path: ["direccion"],
      message: "Con envío hace falta la dirección de entrega.",
    });
    return;
  }

  // La misma regla de RN-10 que valida la libreta del comprador (F5.3): la
  // zona de entrega es una lista cerrada, y «Otra localidad cercana» pide
  // nombre y provincia.
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
