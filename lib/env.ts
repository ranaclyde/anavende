/**
 * Bandera de aprovisionamiento. Mientras F0 no esté hecha no hay Supabase
 * contra el cual autenticarse, y el sitio tiene que poder levantarse igual
 * para trabajar el resto de F1.
 *
 * Los secretos de servidor NUNCA llevan el prefijo NEXT_PUBLIC_
 * (TECHNICAL-SPEC §16, §18.3): lo que lleva ese prefijo se embebe en el
 * bundle del navegador.
 */
export const hasSupabaseEnvVars = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * De dónde se sirve el sitio, con `https://…` y sin barra final.
 *
 * Existe porque el mismo `?? "http://localhost:3000"` ya estaba escrito en
 * dos lugares —el `metadataBase` del layout y el enlace de confirmación de
 * los emails— y hoy haría falta un tercero: el enlace de la ficha que viaja
 * dentro de un mensaje de WhatsApp (F3.6). Tres copias de un respaldo es
 * cómo se termina teniendo dos respaldos distintos.
 *
 * El respaldo NO es adorno: `next build` corre sin `.env.local` y sin él
 * `new URL()` falla en tiempo de construcción. Lo que hay que cuidar en
 * producción es que la variable esté puesta, no que este valor sea bueno.
 */
export function urlDelSitio(): string {
  const crudo = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return crudo.replace(/\/+$/, "");
}
