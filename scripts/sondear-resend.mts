/**
 * Sondeo de Resend — F0.11, TECHNICAL-SPEC §14, V2.
 *
 * F0.11 pide que «un email de verificación llegue a una casilla de verdad», y
 * ese email lo emite GoTrue por SMTP (E1, §14). Antes de tocar la
 * configuración de Supabase conviene separar las dos mitades del problema,
 * porque si falla el conjunto no se sabe cuál de las dos fue:
 *
 *   1. ¿La API key sirve y el dominio está verificado?
 *   2. ¿Resend acepta mandarle a una dirección cualquiera —no solo a la
 *      casilla de la cuenta— desde `RESEND_FROM`?
 *
 * Las dos se responden desde acá, sin VPS y sin instalar el SDK: es la API
 * REST y `fetch` alcanza. Si esto pasa y el registro en producción igual no
 * manda el email, el problema está en el SMTP de Supabase y no en Resend.
 *
 *   npx tsx scripts/sondear-resend.mts tu-casilla@gmail.com
 */
try { process.loadEnvFile(".env.local"); } catch {}

const clave = process.env.RESEND_API_KEY;
const remitente = process.env.RESEND_FROM;
const destino = process.argv[2];

let fallos = 0;
const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

if (!clave) {
  console.error(
    "✋ Falta RESEND_API_KEY en .env.local.\n" +
      "   Se crea en Resend → API Keys → Create API Key.",
  );
  process.exit(1);
}

const api = (ruta: string, init?: RequestInit) =>
  fetch(`https://api.resend.com${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

// ── 1. La clave y el estado del dominio ────────────────────────────────
console.log("── El dominio (F0.11) ──");

const r = await api("/domains");
ok(r.ok, `La API key sirve (HTTP ${r.status})`);

if (!r.ok) {
  console.error(await r.text());
  process.exit(1);
}

type Dominio = { name: string; status: string; region?: string };
const cuerpo = (await r.json()) as { data?: Dominio[] };
const dominios = cuerpo.data ?? [];

ok(dominios.length > 0, `Hay ${dominios.length} dominio(s) en la cuenta`);

for (const d of dominios) {
  ok(
    d.status === "verified",
    `${d.name}: ${d.status}${d.region ? ` (${d.region})` : ""}`,
  );
}

// El remitente tiene que ser de un dominio verificado: `onboarding@resend.dev`
// solo le escribe a la casilla de la propia cuenta, y eso no es producción.
if (remitente) {
  const suDominio = remitente.split("@").pop()?.replace(">", "").trim();
  ok(
    dominios.some((d) => d.name === suDominio && d.status === "verified"),
    `RESEND_FROM usa un dominio verificado (${suDominio})`,
  );
} else {
  ok(false, "Falta RESEND_FROM en .env.local");
}

// ── 2. Un envío de verdad ──────────────────────────────────────────────
if (!destino) {
  console.log(
    "\nℹ️  Sin destinatario no se manda nada. Para probar el envío:\n" +
      "   npx tsx scripts/sondear-resend.mts tu-casilla@gmail.com",
  );
} else if (fallos === 0) {
  console.log(`\n── El envío, a ${destino} ──`);

  const envio = await api("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: remitente,
      to: [destino],
      subject: "AnaVende — prueba de F0.11",
      text:
        "Si estás leyendo esto, Resend acepta enviar desde el dominio de " +
        "AnaVende a una casilla cualquiera.\n\n" +
        "Falta la otra mitad de F0.11: que Supabase use este mismo Resend " +
        "como SMTP para el email de verificación (E1).",
    }),
  });

  const respuesta = await envio.json();
  ok(envio.ok, `Resend aceptó el envío (HTTP ${envio.status})`);
  if (!envio.ok) console.error(respuesta);
  else console.log(`   id: ${(respuesta as { id?: string }).id}`);

  console.log(
    "\n⚠️  Que Resend lo acepte NO es que haya llegado. Mirá la casilla, y\n" +
      "   revisá spam: es la primera vez que este dominio manda algo.",
  );
}

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo en orden.");
process.exit(fallos ? 1 : 0);
