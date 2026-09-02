import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Cliente de Drizzle — TECHNICAL-SPEC §2.1, §18.3, §20.
 *
 * La conexión va por la IP PRIVADA del servidor DATA: Postgres no escucha en
 * la interfaz pública (§2.4, F0.4). `DATABASE_URL` es secreto de servidor y
 * nunca lleva el prefijo NEXT_PUBLIC_ (§16).
 *
 * Una sola instancia por proceso: cada `postgres()` abre su propio pool, y
 * varios pools contra un servidor de 4 GB se comen las conexiones.
 */

declare global {
  var __anavendeSql: ReturnType<typeof postgres> | undefined;
}

function crearConexion() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Se configura cuando F0.3 esté hecha; ver .env.example.",
    );
  }
  return postgres(url, {
    // La LAN privada mide 1-2 ms (§20): no hace falta un pool grande.
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// En desarrollo el recargado en caliente reevalúa el módulo; sin esto se
// abriría un pool nuevo en cada cambio hasta agotar las conexiones.
const sql = globalThis.__anavendeSql ?? crearConexion();
if (process.env.NODE_ENV !== "production") {
  globalThis.__anavendeSql = sql;
}

export const db = drizzle(sql, { schema });
export { schema };
