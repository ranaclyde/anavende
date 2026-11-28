/**
 * Genera el `-og.jpg` de las fotos subidas antes de que la canalización lo
 * hiciera, a partir del `-detail.webp` (el original no se guarda, §9.0).
 *
 * Escribe en el Storage al que apunte el entorno, que puede ser producción:
 * sin `--confirmar` solo dice a cuál apuntaría y qué haría. Solo crea
 * `-og.jpg` nuevos: no borra ni pisa nada y no toca la base; se puede repetir.
 *
 *   npx tsx scripts/derivar-og-productos.mts              # dice qué haría
 *   npx tsx scripts/derivar-og-productos.mts --confirmar  # lo hace
 */
import postgres from "postgres";

import { almacenamiento } from "@/lib/storage";
import { procesarImagen } from "@/modules/media/procesar";
import { clave, TAMANOS_OG, tipoDe } from "@/modules/media/tamanos";

try {
  process.loadEnvFile(".env.local");
} catch {
  // En el servidor las variables ya vienen del entorno.
}

const CONFIRMADO = process.argv.includes("--confirmar");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const store = almacenamiento();

/** Las claves base, sin sufijo ni extensión. */
const filas = await sql<{ storageKey: string }[]>`
  SELECT storage_key AS "storageKey"
    FROM variant_images
   ORDER BY created_at`;

console.log(`Storage: ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host}`);
console.log(`${filas.length} imágenes de producto en la base.\n`);

let hechas = 0;
let salteadas = 0;
const fallidas: string[] = [];

for (const { storageKey } of filas) {
  const destino = clave(storageKey, "og");

  // Por HTTP y no por la API de Storage: es lo que va a pedir WhatsApp.
  const yaEsta = await fetch(store.publicUrl(destino), { method: "HEAD" });
  if (yaEsta.ok) {
    salteadas++;
    continue;
  }

  if (!CONFIRMADO) {
    console.log(`· generaría ${destino}`);
    hechas++;
    continue;
  }

  try {
    const origen = await fetch(store.publicUrl(clave(storageKey, "detail")));
    if (!origen.ok) throw new Error(`el -detail devolvió ${origen.status}`);

    const entrada = Buffer.from(await origen.arrayBuffer());

    const { versiones } = await procesarImagen(entrada, TAMANOS_OG);

    await store.put(destino, versiones[0].cuerpo, tipoDe("og"));
    console.log(`✅ ${destino} — ${Math.round(versiones[0].bytes / 1024)} KB`);
    hechas++;
  } catch (e) {
    console.log(`❌ ${destino} — ${e instanceof Error ? e.message : e}`);
    fallidas.push(destino);
  }
}

console.log(
  `\n${CONFIRMADO ? "Generadas" : "Se generarían"}: ${hechas}. ` +
    `Ya estaban: ${salteadas}. Fallaron: ${fallidas.length}.`,
);

if (!CONFIRMADO && hechas > 0) {
  console.log("\nNada se escribió. Para hacerlo: agregá --confirmar.");
}

await sql.end();

if (fallidas.length > 0) process.exit(1);
