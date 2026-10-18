/**
 * El token de prueba de Cloudflare Turnstile — F10.5b.
 *
 * El GoTrue del stack local tiene el captcha prendido con el secreto de
 * prueba que siempre aprueba (`supabase/config.toml`, `[auth.captcha]`), así
 * que pide un token para ingresar, dar de alta, recuperar y reenviar. Las
 * pruebas que llaman a esas acciones directo, sin pantalla, mandan este.
 */
export const CAPTCHA_DE_PRUEBA = "XXXX.DUMMY.TOKEN.XXXX";
