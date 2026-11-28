/**
 * Aplica las migraciones pendientes al arrancar el contenedor, antes del
 * servidor (TECHNICAL-SPEC §18.2): si falla, el contenedor no arranca, a
 * propósito. Usa el migrador de `drizzle-orm` y no drizzle-kit, que no va en
 * la imagen; lee la misma carpeta y la misma tabla
 * (`drizzle.__drizzle_migrations`). `.mjs` porque la imagen no tiene TypeScript.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("[migrar] Falta DATABASE_URL. No se arranca a ciegas.");
  process.exit(1);
}

// `max: 1`: el bloqueo de la migración y las sentencias tienen que ir por la
// misma conexión.
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
