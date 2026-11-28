import type { ErrorEvent } from "@sentry/nextjs";

// Datos personales fuera de Sentry (TECHNICAL-SPEC §16, §19). Por nombre de
// clave y en profundidad, no por rutas: la ruta que se olvide filtra el dato.
const SENSITIVE_KEYS = [
  "email",
  "phone",
  "telefono",
  "teléfono",
  "address",
  "direccion",
  "dirección",
  "street",
  "calle",
  "password",
  "contrasena",
  "contraseña",
  "token",
  "authorization",
  "cookie",
  "customer_name",
  "customername",
  "full_name",
  "fullname",
  "recipient_name",
  "recipientname",
  "shipping_address",
  "shippingaddress",
  "postal_code",
  "postalcode",
];

const REDACTED = "[filtrado]";

function isSensitive(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, depth + 1));
  }
  const output: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    output[k] = isSensitive(k) ? REDACTED : scrub(v, depth + 1);
  }
  return output;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.user) {
    event.user = { id: event.user.id };
  }

  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      event.request.headers = scrub(event.request.headers) as Record<
        string,
        string
      >;
    }
    // Entera: ahí viajan búsquedas y a veces emails.
    delete event.request.query_string;
  }

  if (event.extra) {
    event.extra = scrub(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrub(event.contexts) as typeof event.contexts;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: scrub(b.data) as Record<string, unknown> | undefined,
    }));
  }

  return event;
}
