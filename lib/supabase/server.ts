import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { goTrueHeaders } from "@/lib/supabase/client-ip";

/**
 * No guardarlo en una variable global: uno nuevo en cada función que lo use.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Para que GoTrue cuente los intentos por comprador y no por tienda.
      global: { headers: goTrueHeaders(await headers()) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component, que no puede escribir cookies:
            // se ignora porque el proxy renueva la sesión.
          }
        },
      },
    },
  );
}
