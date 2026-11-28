import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnvVars } from "@/lib/env";
import { goTrueHeaders } from "@/lib/supabase/client-ip";
import {
  estaEnMantenimiento,
  pasaSiempre,
  puedeVerLaTiendaCerrada,
  REINTENTAR_EN_SEGUNDOS,
} from "@/modules/settings/mantenimiento";
import { tieneElAccesoCortado } from "@/modules/users/acceso";

// Esto no es el control de acceso (TECHNICAL-SPEC §13.7): solo evita que
// alguien sin cookie pinte una pantalla privada. La autorización real va en
// cada acción, página y consulta.

const PRIVATE_ROUTES = [
  "/admin",
  "/mi-cuenta",
  "/carrito",
  "/checkout",
  "/orden",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnvVars) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // La renovación de la sesión, contada al comprador y no a la tienda.
      global: { headers: goTrueHeaders(request.headers) },
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
  const hasIdentity = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPrivate = PRIVATE_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isPrivate && !hasIdentity) {
    return toSignIn(request, pathname);
  }

  // Cuenta bloqueada o dada de baja (RF-27, RF-34): la única capa que cierra la
  // sesión. El token ya emitido se verifica localmente y sigue valiendo hasta
  // que vence. Solo en rutas privadas, para no pagar una consulta por visita.
  if (isPrivate && typeof data?.claims?.sub === "string") {
    if (await tieneElAccesoCortado(data.claims.sub)) {
      return toSignIn(request, pathname, { signingOut: true });
    }
  }

  // De la pregunta más barata a la más cara.
  if (!pasaSiempre(pathname) && (await estaEnMantenimiento())) {
    const userId = data?.claims?.sub;
    const canView =
      typeof userId === "string" && (await puedeVerLaTiendaCerrada(userId));

    if (!canView) return closedShop(request, response);
  }

  // El objeto de respuesta se devuelve tal cual: si se arma uno nuevo hay que
  // copiarle las cookies, o el navegador y el servidor quedan desincronizados.
  return response;
}

/**
 * Con `signingOut` se borran las cookies: si no, `/ingresar` y «Mi cuenta»
 * se rebotarían para siempre. Por nombre y no con `signOut`, que GoTrue le
 * rechaza a una cuenta bloqueada. Por prefijo: el token puede venir partido
 * (`…-auth-token.0`, `.1`).
 */
function toSignIn(
  request: NextRequest,
  pathname: string,
  options?: { signingOut?: boolean },
) {
  const url = request.nextUrl.clone();
  url.pathname = "/ingresar";
  url.search = "";
  url.searchParams.set("volver", pathname + request.nextUrl.search);

  const redirectResponse = NextResponse.redirect(url);

  if (options?.signingOut) {
    for (const cookie of request.cookies.getAll()) {
      if (/^sb-.*-auth-token/.test(cookie.name)) {
        redirectResponse.cookies.delete(cookie.name);
      }
    }
  }

  return redirectResponse;
}

/**
 * Reescritura y no redirección, con 503: un 307 es «se mudó» y un 200
 * desindexaría el sitio. La respuesta es nueva: se le copian las cookies.
 */
function closedShop(request: NextRequest, sessionResponse: NextResponse) {
  const target = request.nextUrl.clone();
  target.pathname = "/mantenimiento";
  target.search = "";

  const closed = NextResponse.rewrite(target, {
    status: 503,
    headers: {
      "Retry-After": String(REINTENTAR_EN_SEGUNDOS),
      // Que Cloudflare o el navegador no sigan mostrando el cartel al reabrir.
      "Cache-Control": "no-store",
    },
  });

  sessionResponse.cookies
    .getAll()
    .forEach((cookie) => closed.cookies.set(cookie));
  return closed;
}
