import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Configuración del sitio — RF-20, §5.9.
 *
 * La tabla es un singleton garantizado por CHECK, pero la fila puede NO
 * existir todavía: quien la crea y la edita es F2.7. Hasta entonces el
 * listado de productos necesita el umbral igual, así que se lee con
 * respaldo en vez de fallar.
 */

/**
 * El mismo `3` que declara `DEFAULT` en la columna (§5.9).
 *
 * Está repetido a propósito y no derivado: la base decide el valor de la
 * fila nueva, y este decide qué pasa cuando NO hay fila. Son dos preguntas
 * distintas que hoy tienen la misma respuesta; el día que F2.7 escriba la
 * fila, esta constante deja de usarse sola.
 */
export const UMBRAL_DE_STOCK_BAJO_POR_DEFECTO = 3;

export async function umbralDeStockBajo(): Promise<number> {
  const [fila] = await db.execute<{ umbral: number }>(sql`
    SELECT low_stock_threshold AS umbral FROM site_settings WHERE id = 1
  `);
  return fila?.umbral ?? UMBRAL_DE_STOCK_BAJO_POR_DEFECTO;
}
