import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next y no hereda las variables de .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // En CI y en el servidor las variables ya vienen del entorno.
}

/**
 * Las migraciones generadas se revisan a mano antes de aplicarse: la base
 * tiene columnas generadas, índices parciales y CHECK (TECHNICAL-SPEC §18.2).
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
