import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { urlDelSitio } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { needsProfile } from "@/lib/session";
import { laTiendaEstaCerradaPara } from "@/modules/settings/mantenimiento";
import { anotarDatosDeGoogle } from "@/modules/users/datos-de-google";

/**
 * Callback de OAuth — TECHNICAL-SPEC §4, §13.4 · RF-06.
 *
 * Acá GoTrue ya creó la identidad, antes de que intervengamos: por eso el
 * perfil se resuelve DESPUÉS, y no se puede exigir teléfono en el alta como
 * en el registro por email.
 */
/**
 * Creada en este mismo ingreso. Una cuenta sin perfil de antes —alguien que
 * entró con Google y nunca completó el teléfono— no la borra este camino.
 */
function esReciente(creadaEl: string): boolean {
  return Date.now() - new Date(creadaEl).getTime() < 10 * 60_000;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // De la configuración y no de `request.url`, por el mismo motivo que en
  // `confirmar/route.ts`: detrás del proxy, esa dirección es `0.0.0.0:3000`.
  const origin = urlDelSitio();
  const code = searchParams.get("code");
  const volverCrudo = searchParams.get("volver");

  // Solo se aceptan destinos internos: un `volver` con host lo convertiría
  // en un redirector abierto.
  const volver =
    volverCrudo && volverCrudo.startsWith("/") && !volverCrudo.startsWith("//")
      ? volverCrudo
      : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/error?motivo=enlace-invalido`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Supabase rechaza la vinculación cuando el email de la cuenta original
    // no está verificado. Es la protección contra apropiación de RF-06.
    return NextResponse.redirect(`${origin}/error?motivo=vinculacion-rechazada`);
  }

  const { session } = data;
  const sinPerfil = await needsProfile();

  // Con la tienda cerrada solo entran las administradoras (decisión tuya del
  // 2026-10-26). GoTrue ya creó la cuenta antes de que lleguemos acá, así que
  // si es nueva se borra: sin esto, cada intento dejaría una cuenta a medias.
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
    // La foto, el nombre y el apellido de Google se averiguan ahora porque
    // el permiso para pedirlos (`provider_token`) solo viene en este
    // intercambio; se usan al completar el perfil
    // (`modules/users/datos-de-google.ts`).
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
