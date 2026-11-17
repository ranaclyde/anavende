/**
 * El destino de una vuelta (`volver`, `next`), solo si es de la tienda.
 *
 * Esos parámetros viajan en la dirección, así que cualquiera puede armar un
 * enlace que los traiga. Si se aceptara cualquier cosa, un enlace a nuestro
 * `/ingresar` mandaría a otro sitio después de ingresar: una redirección
 * abierta, la puerta de entrada clásica de un phishing.
 *
 * Empezar con `/` no alcanza: `//otro.com` es una dirección sin protocolo,
 * que el navegador resuelve contra OTRO host, y `/\otro.com` también, porque
 * el navegador lee la `\` como `/`. Se rechazan las dos.
 *
 * Sin `server-only` a propósito: la usan formularios del navegador.
 */
export function destinoInterno(crudo: string | null | undefined) {
  if (!crudo || !crudo.startsWith("/")) return undefined;
  if (crudo.startsWith("//") || crudo.startsWith("/\\")) return undefined;
  return crudo;
}
