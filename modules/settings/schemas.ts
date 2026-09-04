import { z } from "zod";

import { telefonoArgentino } from "@/lib/telefono";
import {
  AYUDA_DEL_UMBRAL,
  UMBRAL_MAXIMO,
  UMBRAL_MINIMO,
} from "@/modules/settings/limites";

/**
 * Validación de los medios de pago (RF-19) y de la configuración del sitio
 * (RF-20). Comparten archivo porque comparten módulo: los dos son las
 * tablas que la vendedora carga una vez y toca cada tanto (§5.9).
 *
 * No es `server-only` como el de productos: acá no hay nada que sanitizar
 * —la descripción es texto plano— y el formulario repite estos mismos
 * esquemas para avisar antes de enviar. Quien decide sigue siendo el
 * servidor, que los vuelve a correr en el envoltorio (§6.2, paso 3).
 */

const nombre = z
  .string()
  .trim()
  .min(2, "El nombre necesita al menos 2 caracteres.")
  .max(60, "El nombre no puede pasar de 60 caracteres.");

/**
 * La descripción corta de RF-19 —«10% off transfiriendo»—, no un párrafo.
 *
 * Se guarda `null` y no `""` cuando está vacía: la columna es opcional, y
 * dos formas de decir «no hay» obligan a preguntar por las dos en cada
 * consulta y en cada pantalla. El tope de 120 no es arbitrario: es lo que
 * entra en la franja de la tienda sin partir la fila (RF-01).
 */
const descripcion = z
  .string()
  .trim()
  .max(120, "La descripción no puede pasar de 120 caracteres.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

export const crearMedioDePago = z.object({
  name: nombre,
  description: descripcion,
});

export const editarMedioDePago = z.object({
  id: z.uuid(),
  name: nombre,
  description: descripcion,
});

export const soloMedioDePago = z.object({ id: z.uuid() });

export const cambioDeEstadoDePago = z.object({
  id: z.uuid(),
  activo: z.boolean(),
});

/**
 * Mover es «uno para arriba» o «uno para abajo», no «poné este número».
 *
 * `sort_order` es una posición y no un dato que la vendedora tenga que
 * llevar: pedirle el número la obliga a renumerar a mano cuando quiere meter
 * uno en el medio, que es justo el trabajo que la computadora hace bien.
 */
export const movimientoDePago = z.object({
  id: z.uuid(),
  direccion: z.enum(["arriba", "abajo"]),
});

export type CrearMedioDePago = z.infer<typeof crearMedioDePago>;
export type EditarMedioDePago = z.infer<typeof editarMedioDePago>;

/* ── Configuración del sitio — RF-20, §5.9 ─────────────────────────────── */

/**
 * El número por el que se coordinan las ventas (RF-04).
 *
 * Es la misma regla que el teléfono del comprador y por eso sale del mismo
 * lugar (`lib/telefono.ts`): se guarda normalizado a `+549…` para que
 * `wa.me` se arme concatenando y no haya que adivinar, en cada enlace, qué
 * forma tenía el que se cargó.
 */
const numeroDeWhatsapp = telefonoArgentino({
  requerido: "Escribí el número de WhatsApp por el que vendés.",
  invalido:
    "Ese número no parece válido. Escribilo con característica, por ejemplo 11 5555 5555.",
});

/**
 * A dónde llegan los avisos de órdenes nuevas (E4).
 *
 * No es el email con el que la vendedora entra al panel: puede querer los
 * avisos en otra casilla, y atarlos a la identidad la obligaría a cambiar
 * de cuenta para cambiar de casilla.
 */
const emailDeAvisos = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Ese email no parece válido."));

/**
 * A partir de cuántas unidades se avisa «Quedan N» (RF-20).
 *
 * Llega como número: el formulario ya comprobó la forma, y dejar que el
 * esquema acepte texto sería una segunda gramática que mantener.
 *
 * Los topes y la frase que los explica viven en `limites.ts`, que el
 * formulario también lee. El máximo es el único con mensaje propio: es el
 * único que se puede chocar escribiendo un número perfectamente válido, y
 * ahí lo que hay que decir no es la regla sino por qué existe.
 */
const umbralDeStock = z
  .number({ error: AYUDA_DEL_UMBRAL })
  .int(AYUDA_DEL_UMBRAL)
  .min(UMBRAL_MINIMO, AYUDA_DEL_UMBRAL)
  .max(
    UMBRAL_MAXIMO,
    `Más de ${UMBRAL_MAXIMO} marca casi todo el catálogo, y el aviso deja de señalar nada.`,
  );

export const configuracionDelSitio = z.object({
  whatsappNumber: numeroDeWhatsapp,
  adminNotificationEmail: emailDeAvisos,
  lowStockThreshold: umbralDeStock,
});

export type EntradaDeConfiguracion = z.input<typeof configuracionDelSitio>;
