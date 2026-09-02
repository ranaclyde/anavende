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
