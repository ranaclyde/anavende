/**
 * El GoTrue local exige captcha con el secreto de prueba de Turnstile, que
 * aprueba siempre (`supabase/config.toml`): las pruebas sin pantalla mandan este.
 */
export const CAPTCHA_DE_PRUEBA = "XXXX.DUMMY.TOKEN.XXXX";
