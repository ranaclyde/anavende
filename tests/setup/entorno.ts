import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { afterAll } from "vitest";

import { cerrarConexion } from "@/db";
// La extensión va a la vista porque el archivo es `.mts`: lo permite
// `allowImportingTsExtensions` en el tsconfig, que está justamente por esto.
import {
  dondeApunta,
  esApiDelStackLocal,
  esStackLocal,
} from "@/scripts/solo-local.mts";

/**
 * Lo que corre antes de cada archivo de test — TECHNICAL-SPEC §17.1.
 *
 * Hace tres cosas, y la del medio es la que importa.
 */

// 1. El entorno sale de `.env.test`, NUNCA de `.env.local`.
//
// Desde el 2026-09-05 `.env.local` apunta al servidor DATA de producción
// (§18.2). Si estos tests lo leyeran, reservarían y venderían stock en el
// catálogo de verdad.
//
// NO SE USA `process.loadEnvFile`, y el motivo está comprobado: esa función
// respeta lo que ya está en el entorno, así que un `export DATABASE_URL=…`
// suelto en la terminal —o heredado de otra herramienta— le ganaría al
// archivo. Acá el archivo tiene que ganar siempre. `parseEnv` es el mismo
// parser que usa Node por dentro, sin dependencia nueva.
//
// EL ARCHIVO NO ESTÁ EN EL REPOSITORIO, por decisión tuya del 2026-09-07: lo
// que se commitea es `.env.test.example`, con los valores vacíos. Las claves
// del stack local no son secretas —vienen fijas en el CLI de Supabase— y aun
// así una clave en el repositorio es una clave en el repositorio.
//
// El precio es este `catch`: en un clon nuevo hay que armar el archivo antes
// de que `npm test` corra. Vale que el error lo diga con los dos comandos
// exactos, y no con un ENOENT sobre una ruta.
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

// 2. Y si aun así apuntara a otro lado, no se corre nada.
//
// La regla de «esto es el stack local» es la misma que usan los scripts de
// verificación, importada, no copiada: loopback y el puerto 54322 de
// `supabase/config.toml`. Vale recordar por qué mira el puerto y no solo el
// host: el acceso a producción va por un túnel SSH, y a través de un túnel
// producción se ve como `127.0.0.1`.
//
// No hay escape por variable de entorno, y esa es la diferencia con
// `soloLocal()`. Un script de verificación contra producción tiene un caso
// legítimo algún día; una batería de tests que crea órdenes y las cancela,
// ninguno.
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

// 2b. Y lo mismo con Storage, que es la OTRA puerta.
//
// Desde el 2026-09-07 `.env.test` lleva también la URL y las claves de la API
// del stack local: los tests migrados de F2.2, F2.4 y F2.6 suben y borran
// archivos de verdad, porque §17.1 pide Storage real y no un doble.
//
// Apuntar bien la base no dice NADA de Storage: son dos puertas distintas, el
// 54322 y el 54321. Sin esta comprobación, una `SUPABASE_SERVICE_ROLE_KEY` de
// producción pegada acá al lado de una `DATABASE_URL` local dejaría los tests
// subiendo archivos de prueba al bucket de Ana con todo en verde — y los
// huérfanos en Storage no los encuentra ni los borra nadie.
//
// Es lo que reemplaza al «NO LLEVA NI UNA VARIABLE MÁS» que el archivo decía
// antes: la regla no cambió de sentido, cambió de lugar. Un comentario pide;
// esto impide.
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

// 3. Al terminar, cerrar el pool.
//
// `db` abre hasta diez conexiones y las mantiene vivas. Un proceso de test
// que las deja abiertas no termina: Vitest se queda esperando y hay que
// matarlo a mano, que es exactamente el tipo de fricción por la que un día
// los tests dejan de correrse.
afterAll(async () => {
  await cerrarConexion();
});
