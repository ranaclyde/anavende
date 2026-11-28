/**
 * El destino de una vuelta (`volver`, `next`), solo si es de la tienda: evita
 * una redirección abierta. `//otro.com` y `/\otro.com` (el navegador lee la
 * `\` como `/`) van a otro host, así que empezar con `/` no alcanza.
 *
 * Sin `server-only` a propósito: la usan formularios del navegador.
 */
export function internalRedirectTarget(raw: string | null | undefined) {
  if (!raw || !raw.startsWith("/")) return undefined;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return undefined;
  return raw;
}
