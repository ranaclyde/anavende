import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { afterAll } from "vitest";

import { cerrarConexion } from "@/db";
// Con extensión porque es `.mts` (`allowImportingTsExtensions` en el tsconfig).
import {
  dondeApunta,
  esApiDelStackLocal,
  esStackLocal,
} from "@/scripts/solo-local.mts";

// El entorno sale de `.env.test`, no de `.env.local`. No con
// `process.loadEnvFile`: respeta lo que ya está en el entorno, y un
// `DATABASE_URL` exportado en la terminal le ganaría al archivo.
const archivo = new URL("../../.env.test", import.meta.url);

let contenido: string;
try {
  contenido = readFileSync(archivo, "utf8");
} catch {
  throw new Error(
    "Falta `.env.test`, que es de dónde sale el entorno de los tests.\n" +
      "No está en el repositorio a propósito: no se suben claves.\n\n" +
      "  cp .env.test.example .env.test\n" +
      "  npx supabase status      # de acá salen los valores que faltan\n",
  );
}

Object.assign(process.env, parseEnv(contenido));

// Sin escape por variable de entorno: estos tests venden y cancelan stock.
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "Los tests necesitan DATABASE_URL y `.env.test` no la trajo.\n" +
      "Ese archivo se commitea con el repo: si falta, algo lo borró.",
  );
}

if (!esStackLocal(url)) {
  throw new Error(
    `Los tests escriben en la base, y DATABASE_URL apunta a ${dondeApunta(url)}.\n` +
      "Tienen que correr contra el stack local (loopback, puerto 54322):\n" +
      "  npm run dev:stack\n" +
      "Estos tests reservan, venden y devuelven stock. Contra producción eso\n" +
      "entra en el catálogo real.",
  );
}

// Una base local no dice nada de Storage (54322 frente a 54321): sin esto,
// los tests podrían subir archivos al bucket de producción, todo en verde.
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!api || !esApiDelStackLocal(api)) {
  throw new Error(
    `Los tests suben archivos a Storage, y la API de Supabase apunta a ${
      api ? dondeApunta(api, "") : "ningún lado"
    }.\n` +
      "Tiene que ser la del stack local (loopback, puerto 54321):\n" +
      "  npm run dev:stack\n" +
      "Contra producción esto escribiría en el bucket del catálogo real.",
  );
}

// Con el pool abierto, Vitest no termina.
afterAll(async () => {
  await cerrarConexion();
});
