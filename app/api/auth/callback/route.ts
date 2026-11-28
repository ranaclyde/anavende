import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { internalRedirectTarget } from "@/lib/redirect-target";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { needsProfile } from "@/lib/session";
import { laTiendaEstaCerradaPara } from "@/modules/settings/mantenimiento";
import { anotarDatosDeGoogle } from "@/modules/users/datos-de-google";

// Callback de OAuth (§13.4): GoTrue ya creó la identidad antes de llegar
// acá, así que el perfil se resuelve DESPUÉS.

/**
 * Creada en este mismo ingreso: una cuenta sin perfil de antes no la borra
 * este camino.
 */
function esReciente(creadaEl: string): boolean {
  return Date.now() - new Date(creadaEl).getTime() < 10 * 60_000;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // De la configuración y no de `request.url`: detrás del proxy, esa
  // dirección es `0.0.0.0:3000`.
  const origin = getSiteUrl();
  const code = searchParams.get("code");
  const volverCrudo = searchParams.get("volver");

  // Solo destinos internos: un `volver` con host lo convertiría en un
  // redirector abierto.
  const volver = internalRedirectTarget(volverCrudo) ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/error?motivo=enlace-invalido`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Supabase rechaza la vinculación si el email de la cuenta original no
    // está verificado: es la protección contra apropiación (RF-06).
    return NextResponse.redirect(
      `${origin}/error?motivo=vinculacion-rechazada`,
    );
  }

  const { session } = data;
  const sinPerfil = await needsProfile();

  // Con la tienda cerrada solo entran las administradoras. GoTrue ya creó la
  // cuenta, así que si es nueva se borra para no dejarla a medias.
  if (await laTiendaEstaCerradaPara(session.user.id)) {
    await supabase.auth.signOut();
    if (sinPerfil && esReciente(session.user.created_at)) {
      const { error: alBorrar } =
        await createServiceClient().auth.admin.deleteUser(session.user.id);
      if (alBorrar) {
        Sentry.captureException(alBorrar, {
          tags: { capa: "auth-callback", paso: "tienda-cerrada" },
        });
      }
    }
    return NextResponse.redirect(`${origin}/mantenimiento`);
  }

  if (sinPerfil) {
    // Ahora o nunca: `provider_token` solo viene en este intercambio.
    if (
      session.user.app_metadata.provider === "google" &&
      session.provider_token
    ) {
      await anotarDatosDeGoogle(session.user.id, session.provider_token);
    }

    const destino = new URL("/completar-perfil", origin);
    destino.searchParams.set("volver", volver);
    return NextResponse.redirect(destino);
  }

  return NextResponse.redirect(`${origin}${volver}`);
}
