/**
 * Qué cuenta como «el stack local», en un solo lugar. Mira loopback y el
 * puerto de `supabase/config.toml`, no solo el host: por el túnel SSH,
 * producción también se ve como `127.0.0.1`.
 *
 *     EL TÚNEL SSH NUNCA USA EL PUERTO 54322.
 *
 * Si lo usara, esto dejaría pasar los tests contra producción.
 */

/** El de `supabase/config.toml`, `[db] port`. Si cambia allá, cambia acá. */
const PUERTO_DEL_STACK_LOCAL = "54322";

/** El de `supabase/config.toml`, `[api] port`: Storage, Auth y el resto. */
const PUERTO_API_DEL_STACK_LOCAL = "54321";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function esStackLocal(crudo: string): boolean {
  return esLoopbackEnPuerto(crudo, PUERTO_DEL_STACK_LOCAL);
}

/**
 * La API (Storage, Auth) aparte de la base: apuntar bien una no dice nada de
 * la otra.
 */
export function esApiDelStackLocal(crudo: string): boolean {
  return esLoopbackEnPuerto(crudo, PUERTO_API_DEL_STACK_LOCAL);
}

function esLoopbackEnPuerto(crudo: string, puerto: string): boolean {
  let url: URL;
  try {
    url = new URL(crudo);
  } catch {
    return false;
  }
  return LOOPBACK.has(url.hostname) && url.port === puerto;
}

/**
 * Para los mensajes de error: «127.0.0.1:5433». Con `porOmision = ""` no
 * inventa un «:5432» en una URL `https://` que no es de Postgres.
 */
export function dondeApunta(crudo: string, porOmision = "5432"): string {
  try {
    const url = new URL(crudo);
    return url.port
      ? `${url.hostname}:${url.port}`
      : porOmision
        ? `${url.hostname}:${porOmision}`
        : url.hostname;
  } catch {
    return crudo;
  }
}
