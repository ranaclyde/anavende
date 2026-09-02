/**
 * Sondeo de la Admin API de Auth — equivalente local de F0.12 y V3/V3b.
 *
 * Responde tres preguntas que la especificación da por sentadas y de las que
 * depende el diseño de F1.7:
 *
 *   1. ¿Un usuario sin email confirmado PUEDE iniciar sesión? RF-05 dice que
 *      sí («puede iniciar sesión pero no puede confirmar órdenes»). Si GoTrue
 *      lo impide, RF-05 o la configuración tienen que cambiar.
 *   2. ¿Qué error exacto recibe un usuario BLOQUEADO al intentar entrar?
 *      De eso depende cómo se detecta el bloqueo para mostrar el motivo
 *      (RF-27, §13.5).
 *   3. ¿`generateLink` manda el email o solo devuelve el enlace?
 */
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile(".env.local"); } catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `sonda-${Date.now()}@anavende.test`;
const password = "una-clave-larga-8";

console.log("── 1. Alta con la Admin API, sin confirmar el email ──");
const { data: alta, error: errAlta } = await admin.auth.admin.createUser({
  email, password, email_confirm: false,
});
console.log(errAlta ? `❌ ${errAlta.message}` : `✅ creado ${alta.user!.id}`);
console.log(`   email_confirmed_at = ${alta.user?.email_confirmed_at ?? "null"}`);

console.log("\n── 2. ¿Puede iniciar sesión SIN confirmar? (RF-05) ──");
const r1 = await anon.auth.signInWithPassword({ email, password });
if (r1.error) {
  console.log(`❌ NO puede — code=${r1.error.code} status=${r1.error.status}`);
  console.log(`   mensaje: "${r1.error.message}"`);
} else {
  console.log(`✅ SÍ puede — sesión emitida, expira en ${r1.data.session?.expires_in}s`);
}

console.log("\n── 3. Bloqueo (RF-27, §13.5) ──");
const { error: errBan } = await admin.auth.admin.updateUserById(alta.user!.id, {
  ban_duration: "876000h",
});
console.log(errBan ? `❌ ${errBan.message}` : "✅ bloqueado con ban_duration");

const r2 = await anon.auth.signInWithPassword({ email, password });
if (r2.error) {
  console.log(`   Al intentar entrar: code=${r2.error.code} status=${r2.error.status}`);
  console.log(`   mensaje: "${r2.error.message}"`);
  console.log(`   ¿distinguible de una contraseña mala? ${r2.error.code === "invalid_credentials" ? "NO — es el mismo error" : "sí"}`);
} else {
  console.log("   ⚠️  entró igual: el bloqueo no impidió el ingreso");
}

console.log("\n── 4. Contraseña incorrecta, para comparar ──");
const r3 = await anon.auth.signInWithPassword({ email, password: "otra-clave-mala" });
console.log(`   code=${r3.error?.code} status=${r3.error?.status} mensaje="${r3.error?.message}"`);

console.log("\n── 5. Desbloqueo ──");
const { error: errUnban } = await admin.auth.admin.updateUserById(alta.user!.id, {
  ban_duration: "none",
});
console.log(errUnban ? `❌ ${errUnban.message}` : "✅ desbloqueado");

console.log("\n── 6. ¿generateLink manda el email o solo lo devuelve? ──");
const { data: link, error: errLink } = await admin.auth.admin.generateLink({
  type: "signup",
  email: `sonda2-${Date.now()}@anavende.test`,
  password,
});
console.log(errLink ? `❌ ${errLink.message}` : `✅ enlace generado: ${link.properties?.action_link?.slice(0, 70)}...`);

console.log("\n── 7. resend({type:'signup'}) sobre una cuenta sin confirmar ──");
const { error: errResend } = await anon.auth.resend({ type: "signup", email });
console.log(errResend ? `❌ ${errResend.message}` : "✅ aceptado");

console.log("\n── 8. Buzón de Mailpit ──");
const buzon = await fetch("http://127.0.0.1:54324/api/v1/messages?limit=10").then((r) => r.json());
console.log(`   ${buzon.messages_count ?? buzon.total ?? 0} mensajes`);
for (const m of (buzon.messages ?? []).slice(0, 6)) {
  console.log(`   · "${m.Subject}" → ${m.To?.map((t: {Address:string}) => t.Address).join(", ")}`);
}

await admin.auth.admin.deleteUser(alta.user!.id);
console.log("\nSonda borrada.");
