/**
 * Errores de dominio — TECHNICAL-SPEC §6.3.
 *
 * Un error de dominio es un RESULTADO DEL NEGOCIO esperado, no un incidente:
 * «no hay stock» y «la orden ya está finalizada» son respuestas correctas del
 * sistema. Por eso no van a Sentry (§6.2, paso 6) y por eso tienen un mensaje
 * en castellano listo para mostrar.
 *
 * La UI decide CÓMO presentarlo —cartel, campo, diálogo—, nunca lo redacta.
 * Un mensaje escrito en la vista es un mensaje que el día que la regla cambie
 * queda mintiendo.
 */

export type DomainErrorCode =
  | "INSUFFICIENT_STOCK" // RF-08, RF-12
  | "PRICE_CHANGED" // RN-09
  | "PRODUCT_UNAVAILABLE" // RN-05
  | "EMAIL_NOT_VERIFIED" // RF-11
  | "INVALID_ORDER_STATE" // RF-13
  | "RETURN_EXCEEDS_SOLD" // RF-25
  | "VARIANT_HAS_RESERVATIONS" // RF-16
  | "ENTITY_IN_USE" // RN-11
  | "USER_BANNED" // RF-27
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  /** Lo inesperado. El único que no es un resultado del negocio (§6.3). */
  | "INTERNAL";

/**
 * Voseo, sin jerga, y siempre con la acción a seguir
 * (DESIGN-REFERENCE §8 y §10).
 */
const MENSAJES: Record<DomainErrorCode, string> = {
  INSUFFICIENT_STOCK:
    "No queda stock suficiente de ese producto. Ajustá la cantidad y probá de nuevo.",
  PRICE_CHANGED:
    "El precio cambió mientras comprabas. Revisá el resumen y confirmá otra vez.",
  PRODUCT_UNAVAILABLE:
    "Ese producto ya no está disponible. Lo sacamos de tu carrito.",
  EMAIL_NOT_VERIFIED:
    "Antes de comprar necesitás confirmar tu email. Te mandamos el enlace.",
  INVALID_ORDER_STATE: "Esa orden ya cambió de estado. Actualizá la página.",
  RETURN_EXCEEDS_SOLD:
    "No se puede devolver más de lo que se vendió en esa orden.",
  VARIANT_HAS_RESERVATIONS:
    "Ese color tiene unidades reservadas en órdenes activas. Resolvelas antes de sacarlo.",
  ENTITY_IN_USE:
    "Eso está en uso y no se puede borrar. Podés desactivarlo para que deje de aparecer.",
  USER_BANNED: "Tu cuenta está bloqueada.",
  FORBIDDEN: "No tenés permiso para hacer eso.",
  NOT_FOUND: "No encontramos eso que buscabas.",
  VALIDATION: "Revisá los datos: hay algo que no está bien.",
  INTERNAL:
    "No pudimos completar la acción. Probá de nuevo en un momento.",
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  /** Contexto para la vista: qué variante, cuántas unidades quedan, etc. */
  readonly details?: Record<string, unknown>;

  constructor(
    code: DomainErrorCode,
    options?: { message?: string; details?: Record<string, unknown> },
  ) {
    super(options?.message ?? MENSAJES[code]);
    this.name = "DomainError";
    this.code = code;
    this.details = options?.details;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

/**
 * Atajo: `throw domainError("INSUFFICIENT_STOCK", { quedan: 2 })`.
 *
 * `message` en las opciones reemplaza al mensaje por omisión del código. Se
 * usa cuando la misma situación necesita decir algo más preciso —«ese email y
 * esa contraseña no coinciden» en vez del genérico de VALIDATION— sin inventar
 * un código nuevo. El resto de las claves son contexto para la vista.
 */
export function domainError(
  code: DomainErrorCode,
  detalles?: Record<string, unknown> & { message?: string },
): DomainError {
  const { message, ...details } = detalles ?? {};
  return new DomainError(code, {
    message,
    details: Object.keys(details).length ? details : undefined,
  });
}

export function domainMessage(code: DomainErrorCode): string {
  return MENSAJES[code];
}
