import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnvVars } from "@/lib/env";

/**
 * Redirección temprana por sesión ausente — TECHNICAL-SPEC §6.1 y §13.7.
 *
 * ESTO NO ES EL CONTROL DE ACCESO. Solo evita que alguien sin cookie llegue
 * a pintar una pantalla privada. La autorización real se verifica:
 *   - en el layout de /admin, contra `user_profiles` (F1.7c);
 *   - en cada Server Action, con el envoltorio de §6.2, siempre;
 *   - en cada consulta, filtrando por el id de la sesión.
 *
 * Una guardia que vive únicamente acá es una guardia que se puede saltear.
 */

/** Prefijos que exigen sesión. Todo lo demás de la tienda es público. */
const RUTAS_PRIVADAS = ["/admin", "/mi-cuenta", "/carrito", "/checkout"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Sin variables de entorno no hay a quién preguntarle: se deja pasar y las
  // guardias reales de servidor se encargan. Aplica al desarrollo previo a F0.
  if (!hasSupabaseEnvVars) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No se ejecuta nada entre createServerClient y getClaims(): un descuido acá
  // produce cierres de sesión aleatorios muy difíciles de depurar.
  const { data } = await supabase.auth.getClaims();
  const hayIdentidad = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const esPrivada = RUTAS_PRIVADAS.some(
    (prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`),
  );

  if (esPrivada && !hayIdentidad) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    // Para volver a donde estaba después de entrar (RF-07, F5.2).
    url.searchParams.set("volver", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // El objeto de respuesta se devuelve tal cual: si se arma uno nuevo hay que
  // copiarle las cookies, o el navegador y el servidor quedan desincronizados.
  return response;
}
