import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { internalRedirectTarget } from "@/lib/redirect-target";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces de verificación y recuperación. Acepta las DOS
 * formas en que GoTrue devuelve el enlace: `code` (PKCE, el de
 * `@supabase/ssr`) y `token_hash` + `type` (los de `generateLink`). Con una
 * sola, la confirmación se rompe sin decir por qué.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // De la configuración y NO de `request.url`: detrás de Traefik y
  // Cloudflare, Next la arma con `0.0.0.0:3000`. En local no se ve.
  const origin = getSiteUrl();

  // Solo destinos internos: un `next` con host convertiría esto en un
  // redirector abierto.
  const nextCrudo = searchParams.get("next");
  const next = internalRedirectTarget(nextCrudo) ?? "/mi-cuenta";

  const errorDelProveedor = searchParams.get("error");
  if (errorDelProveedor) {
    const codigo = searchParams.get("error_code");
    return NextResponse.redirect(
      `${origin}/error?motivo=${codigo === "otp_expired" ? "enlace-vencido" : "enlace-invalido"}`,
    );
  }

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let fallo: { message: string } | null = null;

  if (code) {
    ({ error: fallo } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error: fallo } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    }));
  } else {
    return NextResponse.redirect(`${origin}/error?motivo=enlace-invalido`);
  }

  // El mensaje crudo de Supabase no se muestra: llega en inglés.
  if (fallo) {
    return NextResponse.redirect(`${origin}/error?motivo=enlace-vencido`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
