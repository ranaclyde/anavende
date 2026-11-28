import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * LA CONEXIÓN ES PEREZOSA a propósito: el build corre sin base (§18.2), y un
 * cliente que conecta al evaluar el módulo lo rompe. Una sola instancia por
 * proceso: cada `postgres()` abre su propio pool.
 */

declare global {
  var __anavendeDb: Conexion | undefined;
}

type Conexion = {
  db: PostgresJsDatabase<typeof schema>;
  sql: ReturnType<typeof postgres>;
};

function conectar(): Conexion {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Se configura cuando F0.3 esté hecha; ver .env.example.",
    );
  }

  const sql = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return { db: drizzle(sql, { schema }), sql };
}

/**
 * En el GLOBAL del proceso, no en una variable del módulo: el recargado en
 * caliente reevalúa el módulo, y Next compila `proxy.ts` aparte con su propia
 * copia. Sin el global, cada copia abriría su pool.
 */
function obtener(): Conexion {
  globalThis.__anavendeDb ??= conectar();
  return globalThis.__anavendeDb;
}

/**
 * Para PROCESOS QUE TERMINAN (tests, scripts): sin esto, `vitest run` se
 * cuelga esperando las conexiones. El servidor de Next no la llama nunca.
 */
export async function cerrarConexion(): Promise<void> {
  const abierta = globalThis.__anavendeDb;
  globalThis.__anavendeDb = undefined;
  await abierta?.sql.end({ timeout: 5 });
}

/** No abre la conexión hasta la primera consulta. */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(obtener().db, prop, receiver);
  },
});

export { schema };
