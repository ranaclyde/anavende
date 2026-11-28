/**
 * La IP del comprador para GoTrue (TECHNICAL-SPEC §16): todo lo que la tienda
 * le pide llega desde la IP del APP, y sin esto un solo comprador insistiendo
 * agotaría el límite de todos. nginx usa la IP solo si la clave coincide.
 *
 * `CF-Connecting-IP` solo es creíble porque al APP no se llega sin pasar por
 * Cloudflare. Sin `server-only`: la usa `proxy.ts`.
 */

/** Una IPv4 o IPv6, por la forma: nada que pueda armar otra cabecera. */
const IP_SHAPE = /^[0-9a-fA-F:.]{2,45}$/;

export function goTrueHeaders(
  requestHeaders: Pick<Headers, "get">,
): Record<string, string> {
  const key = process.env.SUPABASE_CLAVE_CLIENTE_IP;
  const ip = requestHeaders.get("cf-connecting-ip")?.trim();

  if (!key || !ip || !IP_SHAPE.test(ip)) return {};

  return {
    "X-Anavende-Clave": key,
    "X-Anavende-Cliente-Ip": ip,
  };
}
