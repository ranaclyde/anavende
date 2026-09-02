import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Cliente de Drizzle — TECHNICAL-SPEC §2.1, §18.2, §18.3, §20.
 *
 * La conexión va por la IP PRIVADA del servidor DATA: Postgres no escucha en
 * la interfaz pública (§2.4, F0.4). `DATABASE_URL` es secreto de servidor y
 * nunca lleva el prefijo NEXT_PUBLIC_ (§16).
 *
 * LA CONEXIÓN ES PEREZOSA, y eso no es una optimización: §18.2 exige compilar
 * fuera del servidor, donde no hay LAN privada ni base a la que llegar. Un
 * cliente que se conecta al evaluar el módulo rompe el build en cuanto una
 * página importa el esquema.
 *
 * Una sola instancia por proceso: cada `postgres()` abre su propio pool, y
 * varios pools contra un servidor de 4 GB se comen las conexiones.
 */

declare global {
  var __anavendeDb: PostgresJsDatabase<typeof schema> | undefined;
}

function conectar(): PostgresJsDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Se configura cuando F0.3 esté hecha; ver .env.example.",
    );
  }

  const sql = postgres(url, {
    // La LAN privada mide 1-2 ms (§20): no hace falta un pool grande.
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(sql, { schema });
}

function obtener(): PostgresJsDatabase<typeof schema> {
  // En desarrollo el recargado en caliente reevalúa el módulo; sin el global
  // se abriría un pool nuevo en cada cambio hasta agotar las conexiones.
  if (process.env.NODE_ENV !== "production") {
    globalThis.__anavendeDb ??= conectar();
    return globalThis.__anavendeDb;
  }
  interno ??= conectar();
  return interno;
}

let interno: PostgresJsDatabase<typeof schema> | undefined;

/**
 * Se comporta como el cliente de Drizzle, pero no abre la conexión hasta la
 * primera consulta de verdad.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(obtener(), prop, receiver);
  },
});

export { schema };
