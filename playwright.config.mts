import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { defineConfig, devices } from "@playwright/test";

import {
  dondeApunta,
  esApiDelStackLocal,
  esStackLocal,
} from "./scripts/solo-local.mts";

/**
 * Playwright — TECHNICAL-SPEC §2.1, §17.2. Tarea F10.1.
 *
 * Los E2E le pegan a la aplicación corriendo y arman sus datos en la misma
 * base que ella lee. **Por eso el entorno sale de `.env.local` y no de
 * `.env.test`**: es el archivo que lee `next dev`, y si el test escribiera en
 * una base y el servidor leyera otra, cada pantalla daría 404 por el motivo
 * equivocado y el test pasaría.
 *
 * Y la guarda es la misma que la de `tests/setup/entorno.ts`, importada y no
 * copiada: estos tests crean cuentas en GoTrue, órdenes y direcciones, y
 * contra producción eso aparece en el panel de Ana.
 */

const archivo = new URL("./.env.local", import.meta.url);

let contenido: string;
try {
  contenido = readFileSync(archivo, "utf8");
} catch {
  throw new Error(
    "Falta `.env.local`, que es de dónde sacan el entorno `next dev` y los E2E.",
  );
}

Object.assign(process.env, parseEnv(contenido));

const base = process.env.DATABASE_URL ?? "";
const api = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

if (!esStackLocal(base) || !esApiDelStackLocal(api)) {
  throw new Error(
    `Los E2E escriben en la base y en Auth, y \`.env.local\` apunta a ${dondeApunta(base)} ` +
      `y a ${api ? dondeApunta(api, "") : "ningún lado"}.\n` +
      "Tienen que correr contra el stack local (loopback, puertos 54322 y 54321):\n" +
      "  npm run dev:stack",
  );
}

const PUERTO = 3000;

export default defineConfig({
  testDir: "tests/e2e",
  // Como en Vitest: todos comparten la base, y dos archivos a la vez se pisan
  // los datos al limpiar.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: "list",

  // `next dev` compila cada pantalla la primera vez que se pide.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PUERTO}`,
    // Si ya hay un `next dev` levantado en esta copia, se usa ese.
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
