import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de servicio (TECHNICAL-SPEC §13.2): el único que administra usuarios.
 * Su clave nunca sale del servidor ni lleva el prefijo NEXT_PUBLIC_.
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
