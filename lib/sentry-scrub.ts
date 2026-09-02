import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Filtrado de datos personales antes de salir hacia Sentry
 * (TECHNICAL-SPEC §16, §19).
 *
 * Un informe de error viaja a un tercero. Email, teléfono y dirección de un
 * comprador no tienen por qué viajar con él: para depurar alcanza con el id
 * del usuario, que no dice nada por sí solo.
 *
 * El filtro es por NOMBRE DE CLAVE y se aplica en profundidad, no por una
 * lista de rutas conocidas: una ruta nueva aparece con cada función que se
 * escribe, y la que se olvide es la que filtra el dato.
 */
const CLAVES_SENSIBLES = [
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

const OCULTO = "[filtrado]";

function esSensible(clave: string): boolean {
  const k = clave.toLowerCase();
  return CLAVES_SENSIBLES.some((s) => k.includes(s));
}

function limpiar(valor: unknown, profundidad = 0): unknown {
  if (profundidad > 8 || valor === null || typeof valor !== "object") {
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.map((v) => limpiar(v, profundidad + 1));
  }
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    salida[k] = esSensible(k) ? OCULTO : limpiar(v, profundidad + 1);
  }
  return salida;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  // Del usuario se conserva SOLO el id.
  if (event.user) {
    event.user = { id: event.user.id };
  }

  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      event.request.headers = limpiar(event.request.headers) as Record<
        string,
        string
      >;
    }
    // La query string se va entera: ahí viajan búsquedas y a veces emails.
    delete event.request.query_string;
  }

  if (event.extra) {
    event.extra = limpiar(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = limpiar(event.contexts) as typeof event.contexts;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: limpiar(b.data) as Record<string, unknown> | undefined,
    }));
  }

  return event;
}
