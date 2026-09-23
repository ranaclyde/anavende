/**
 * Genera la versión `-og.jpg` de las fotos que ya estaban subidas — F3.9.
 *
 * **Por qué existe.** La vista previa de una ficha compartida por WhatsApp
 * necesita un JPEG (ver `modules/media/tamanos.ts`), y hasta el 2026-09-22 la
 * canalización de F2.2 generaba solo WEBP. Desde ese día toda foto nueva sale
 * con su `-og.jpg`, pero las que ya estaban en Storage no lo tienen, y una
 * ficha vieja compartiría un `og:image` que devuelve 404.
 *
 * **De dónde saca la imagen.** Del `-detail.webp` que ya está en Storage, no
 * del original: el original no se guarda nunca (§9.0). Es una pérdida de
 * calidad de una generación —1400px de ancho contra los 1200 del lienzo—, y
 * para una miniatura de chat no se ve.
 *
 * **Qué escribe, y qué no.** Solo crea objetos `-og.jpg` nuevos. No modifica
 * ni borra ningún archivo existente, y no toca la base: las URLs se arman a
 * partir de `storage_key`, que ya está escrito. La pasada es idempotente —lo
 * que ya tiene su `-og.jpg` se saltea— así que se puede repetir sin miedo.
 *
 * **Contra producción hay que pedirlo a mano.** Sin `--confirmar` no escribe
 * nada: imprime a qué Storage apuntaría y qué haría. La regla del repositorio
 * es que los scripts que escriben no corren contra la base de Ana
 * (`scripts/solo-local.mts`); este es una excepción de una sola vez, y por eso
 * la excepción se pide explícitamente en vez de estar permitida por omisión.
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

/** Las claves base, sin sufijo ni extensión: es lo que guarda la columna. */
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

  // Ya existe: no se rehace. Se pregunta por HTTP y no por la API de Storage
  // porque es la misma pregunta que se va a hacer WhatsApp.
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

    // La MISMA receta que la canalización, y no una copia: si mañana cambia
    // el fondo o la calidad, esto la hereda sin que nadie se acuerde.
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

// Que el proceso falle si alguna falló: si esto corre en una cadena, un 404
// silencioso dejaría fichas sin vista previa y nadie se enteraría.
if (fallidas.length > 0) process.exit(1);
