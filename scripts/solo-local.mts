/**
 * La guarda que separa «probar» de «romperle el catálogo a Ana».
 *
 * Nueve de los scripts de verificación **escriben**: crean marcas, productos
 * y variantes, suben archivos al bucket y después los borran. Contra el
 * stack local eso no le importa a nadie. Contra la base de producción son
 * filas y archivos de mentira dentro del catálogo real —y si el script
 * revienta a mitad, como ya pasó una vez, quedan ahí—.
 *
 * Los que solo LEEN no pasan por acá a propósito: `db:verificar` contra
 * producción es justamente cómo se cierra F0.6, y una guarda que también los
 * frenara convertiría a esta función en algo que hay que esquivar.
 *
 * **Cómo decide, y por qué así.** Mira que la base sea exactamente la del
 * stack local declarado en `supabase/config.toml`: loopback y el puerto
 * 54322. No alcanza con mirar el host, y este es el motivo: el acceso a
 * producción va por un **túnel SSH** (F0.4 exige que Postgres no responda
 * desde afuera), y a través de un túnel producción se ve como `127.0.0.1`.
 * De ahí la regla que hay que respetar del otro lado:
 *
 *     EL TÚNEL SSH NUNCA USA EL PUERTO 54322.
 *
 * Si algún día lo usara, esta guarda dejaría pasar contra producción todo lo
 * que existe para frenar.
 */

/** El de `supabase/config.toml`, `[db] port`. Si cambia allá, cambia acá. */
const PUERTO_DEL_STACK_LOCAL = "54322";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** El escape para el día que haya un motivo de verdad. Se pone a mano. */
const ESCAPE = "PERMITIR_ESCRITURA_FUERA_DE_LOCAL";

export function soloLocal(script: string): void {
  const crudo = process.env.DATABASE_URL;

  if (!crudo) {
    console.error(`✋ ${script} necesita DATABASE_URL y no está definida.`);
    process.exit(1);
  }

  const url = new URL(crudo);
  const donde = `${url.hostname}:${url.port || "5432"}`;
  const esLocal =
    LOOPBACK.has(url.hostname) && url.port === PUERTO_DEL_STACK_LOCAL;

  if (esLocal) return;

  if (process.env[ESCAPE] === "1") {
    console.warn(
      `⚠️  ${script} va a ESCRIBIR en ${donde}, que no es el stack local.\n` +
        `   Corre igual porque ${ESCAPE}=1. Si esto es producción, lo que\n` +
        `   cree y borre pasa por el catálogo de verdad.\n`,
    );
    return;
  }

  console.error(
    `✋ ${script} escribe en la base, y DATABASE_URL apunta a ${donde}.\n` +
      `   El stack local es loopback en el puerto ${PUERTO_DEL_STACK_LOCAL}\n` +
      `   (supabase/config.toml). Este script crea y borra filas de prueba:\n` +
      `   contra producción eso entra en el catálogo real.\n\n` +
      `   Si de verdad querés correrlo ahí: ${ESCAPE}=1 npm run <script>\n`,
  );
  process.exit(1);
}
