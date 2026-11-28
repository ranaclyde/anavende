/**
 * La IP del comprador para GoTrue (TECHNICAL-SPEC §16): todo lo que la tienda
 * le pide llega desde la IP del APP, y sin esto un solo comprador insistiendo
 * agotaría el límite de todos. nginx usa la IP solo si la clave coincide.
 *
 * `CF-Connecting-IP` solo es creíble porque al APP no se llega sin pasar por
 * Cloudflare. Sin `server-only`: la usa `proxy.ts`.
 */

/** Una IPv4 o IPv6, por la forma: nada que pueda armar otra cabecera. */
const FORMA_DE_IP = /^[0-9a-fA-F:.]{2,45}$/;

export function cabecerasParaGoTrue(
  delPedido: Pick<Headers, "get">,
): Record<string, string> {
  const clave = process.env.SUPABASE_CLAVE_CLIENTE_IP;
  const ip = delPedido.get("cf-connecting-ip")?.trim();

  if (!clave || !ip || !FORMA_DE_IP.test(ip)) return {};

  return {
    "X-Anavende-Clave": clave,
    "X-Anavende-Cliente-Ip": ip,
  };
}
