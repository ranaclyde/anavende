/**
 * La IP del comprador, para que GoTrue le cuente los intentos a él y no a la
 * tienda — TECHNICAL-SPEC §16, F10.5.
 *
 * GoTrue limita por persona con la cabecera `X-Cliente-Ip`
 * (`GOTRUE_RATE_LIMIT_HEADER`), que pone el nginx del servidor DATA con la IP
 * de la conexión. Lo que la tienda le pide desde su servidor —el ingreso, el
 * alta, los reenvíos, la recuperación y **la renovación de la sesión de cada
 * comprador en cada visita**— llega todo desde la IP del APP, y sin esto
 * GoTrue lo contaría como una sola persona: alguien insistiendo agotaría el
 * cupo de todos y les cortaría la sesión.
 *
 * Así que la tienda manda la IP del comprador y una clave que solo conocen
 * ella y nginx (`SUPABASE_CLAVE_CLIENTE_IP`). nginx usa esa IP solo si la
 * clave coincide, y borra las dos cabeceras antes de pasarle la petición a
 * Kong (`/etc/nginx/conf.d/anavende-cliente-ip.conf`, PROGRESO.md F10.5).
 *
 * **La IP sale de `CF-Connecting-IP`**, la que pone Cloudflare. Solo se puede
 * creer si al APP no se llega sin pasar por Cloudflare, y eso se cierra en el
 * servidor (PROGRESO.md, F10.5). Sin la cabecera, o sin la clave —en `next
 * dev`, en los tests—, no se manda nada y GoTrue ve la IP del APP, como antes.
 *
 * No lleva `server-only`: la usa también `proxy.ts`. La clave no tiene
 * `NEXT_PUBLIC_`, así que en el navegador `process.env` no la tiene y esto
 * devuelve vacío.
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
