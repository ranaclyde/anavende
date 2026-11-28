// Los secretos de servidor NUNCA llevan el prefijo NEXT_PUBLIC_: se embebería
// en el bundle del navegador (TECHNICAL-SPEC §16, §18.3).
export const hasSupabaseEnvVars = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * De dónde se sirve el sitio, con `https://…` y sin barra final.
 *
 * El respaldo no es adorno: `next build` corre sin `.env.local` y sin él
 * `new URL()` falla al construir. En producción la variable tiene que estar.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
