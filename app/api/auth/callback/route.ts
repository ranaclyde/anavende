import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { needsProfile } from "@/lib/session";

/**
 * Callback de OAuth — TECHNICAL-SPEC §4, §13.4 · RF-06.
 *
 * Acá GoTrue ya creó la identidad, antes de que intervengamos: por eso el
 * perfil se resuelve DESPUÉS, y no se puede exigir teléfono en el alta como
 * en el registro por email.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const volverCrudo = searchParams.get("volver");

  // Solo se aceptan destinos internos: un `volver` con host lo convertiría
  // en un redirector abierto.
  const volver =
    volverCrudo && volverCrudo.startsWith("/") && !volverCrudo.startsWith("//")
      ? volverCrudo
      : "/mi-cuenta";

  if (!code) {
    return NextResponse.redirect(`${origin}/error?motivo=enlace-invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Supabase rechaza la vinculación cuando el email de la cuenta original
    // no está verificado. Es la protección contra apropiación de RF-06.
    return NextResponse.redirect(`${origin}/error?motivo=vinculacion-rechazada`);
  }

  if (await needsProfile()) {
    const destino = new URL("/completar-perfil", origin);
    destino.searchParams.set("volver", volver);
    return NextResponse.redirect(destino);
  }

  return NextResponse.redirect(`${origin}${volver}`);
}
