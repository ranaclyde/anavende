import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Confirmación de email por enlace mágico (TECHNICAL-SPEC §13, §14).
 * Es el destino de los emails E1 y E2 de Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (!tokenHash || !type) {
    redirect("/error?motivo=enlace-invalido");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  // El mensaje crudo de Supabase no se le muestra a nadie: se traduce a un
  // motivo conocido en la pantalla de error (DESIGN-REFERENCE §8, §10).
  if (error) {
    redirect("/error?motivo=enlace-vencido");
  }

  redirect(next);
}
