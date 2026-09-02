import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Confirmación por enlace de email — TECHNICAL-SPEC §13, §14.
 * Es el destino de los emails E1 (verificación) y E2 (recuperación).
 *
 * Acepta las DOS formas en que GoTrue puede devolver el enlace:
 *
 *   · `code`                  — flujo PKCE, el que usa `@supabase/ssr` por
 *                               omisión. Es el que llega en la práctica.
 *   · `token_hash` + `type`   — flujo implícito, y el que usan los enlaces
 *                               generados con `generateLink`.
 *
 * Soportar una sola rompe la confirmación sin decir por qué: se descubrió
 * probando el registro de punta a punta, no leyendo el código.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Solo destinos internos: un `next` con host convertiría esto en un
  // redirector abierto.
  const nextCrudo = searchParams.get("next");
  const next =
    nextCrudo && nextCrudo.startsWith("/") && !nextCrudo.startsWith("//")
      ? nextCrudo
      : "/mi-cuenta";

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

  // El mensaje crudo de Supabase no se le muestra a nadie: llega en inglés y
  // con vocabulario de la plataforma (DESIGN-REFERENCE §8, §10).
  if (fallo) {
    return NextResponse.redirect(`${origin}/error?motivo=enlace-vencido`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
