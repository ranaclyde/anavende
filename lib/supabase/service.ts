import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de SERVICIO — TECHNICAL-SPEC §13.2.
 *
 * Es el único que puede administrar usuarios: crear, bloquear, resetear
 * contraseñas (RF-26, RF-27). Su clave NUNCA sale del servidor y jamás lleva
 * el prefijo NEXT_PUBLIC_, que embebería la credencial en el bundle del
 * navegador.
 *
 * `server-only` hace que importarlo desde un Client Component sea un error
 * de compilación, no un descuido que se descubre en producción.
 *
 * No persiste sesión ni refresca tokens: no representa a nadie, actúa como
 * el sistema.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
