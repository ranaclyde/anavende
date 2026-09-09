/**
 * Aplica las migraciones pendientes al arrancar el contenedor —
 * TECHNICAL-SPEC §18.2.
 *
 * Corre ANTES de levantar el servidor: desplegar y migrar son un solo acto,
 * y no dos que se pueden desincronizar. Si falla, sale con código distinto de
 * cero y el contenedor no arranca — que es lo que se quiere. Una aplicación
 * sirviendo contra un esquema que no es el suyo falla más tarde, peor y en
 * pantalla.
 *
 * **Por qué no es `drizzle-kit migrate` literal**, como dice §18.2: drizzle-kit
 * es una dependencia de desarrollo y arrastra esbuild, y meterla en la imagen
 * de producción son decenas de megas de herramienta de construcción del lado
 * de adentro. El migrador de `drizzle-orm` lee **la misma carpeta** y lleva la
 * cuenta en **la misma tabla** (`drizzle.__drizzle_migrations`) — es lo que
 * drizzle-kit usa por debajo—, así que no hay dos libros ni dos criterios.
 * Se verifica corriéndolo contra una base ya migrada: no debe aplicar nada.
 *
 * Es `.mjs` y no `.mts` porque acá adentro no hay TypeScript: la imagen final
 * no tiene con qué compilar, y no debería tenerlo.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("[migrar] Falta DATABASE_URL. No se arranca a ciegas.");
  process.exit(1);
}

// `max: 1` no es una optimización: el migrador necesita una sola conexión
// para que el bloqueo de la migración y las sentencias vayan por el mismo
// lado.
const sql = postgres(url, { max: 1 });

try {
  console.log("[migrar] Aplicando migraciones pendientes…");
  await migrate(drizzle(sql), { migrationsFolder: "./db/migrations" });
  console.log("[migrar] Esquema al día.");
} catch (error) {
  console.error("[migrar] Falló la migración. El contenedor no arranca.");
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}
