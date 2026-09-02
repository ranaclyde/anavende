import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next, así que no hereda las variables de
// .env.local. Node 22 puede cargarlas solo.
try {
  process.loadEnvFile(".env.local");
} catch {
  // En CI y en el servidor las variables ya vienen del entorno.
}

/**
 * TECHNICAL-SPEC §5, §18.2.
 * Las migraciones se generan con `drizzle-kit generate` y se revisan a mano
 * antes de aplicarse: la base tiene columnas generadas, índices parciales y
 * restricciones CHECK que no son un adorno.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
