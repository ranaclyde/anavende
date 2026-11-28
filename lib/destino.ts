/**
 * El destino de una vuelta (`volver`, `next`), solo si es de la tienda: evita
 * una redirección abierta. `//otro.com` y `/\otro.com` (el navegador lee la
 * `\` como `/`) van a otro host, así que empezar con `/` no alcanza.
 *
 * Sin `server-only` a propósito: la usan formularios del navegador.
 */
export function destinoInterno(crudo: string | null | undefined) {
  if (!crudo || !crudo.startsWith("/")) return undefined;
  if (crudo.startsWith("//") || crudo.startsWith("/\\")) return undefined;
  return crudo;
}
