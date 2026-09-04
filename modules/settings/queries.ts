import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { urlDeLogo } from "@/modules/media/subir";

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

/**
 * Los medios de pago del panel — RF-19.
 *
 * El orden es el que se configuró, y el nombre desempata: `sort_order` se
 * renumera sin huecos en cada alta, baja y movimiento (`actions.ts`), pero
 * dos filas pueden compartir número si alguien las escribe por fuera del
 * panel. Sin el desempate, esas dos cambiarían de lugar entre dos cargas de
 * la misma pantalla.
 *
 * **Es el mismo orden que usa `moverMedioDePago` para saber quién está
 * arriba de quién.** Si discreparan, la flecha movería el de al lado.
 */
export type MedioDePagoDelPanel = {
  id: string;
  name: string;
  description: string | null;
  /**
   * La URL del logo, ya resuelta. `null` = no tiene. La vista recibe una URL
   * y no una clave a propósito: armarla necesita el adaptador de
   * almacenamiento (§9.4), que es código de servidor.
   */
  logoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

export async function listarMediosDePago(): Promise<MedioDePagoDelPanel[]> {
  const filas = await db.execute<
    Omit<MedioDePagoDelPanel, "logoUrl"> & { logoKey: string | null }
  >(sql`
    SELECT id, name, description,
           logo_key   AS "logoKey",
           sort_order AS "sortOrder",
           is_active  AS "isActive"
      FROM payment_methods
     ORDER BY sort_order, immutable_unaccent(lower(name))
  `);

  return filas.map(({ logoKey, ...fila }) => ({
    ...fila,
    logoUrl: urlDeLogo(logoKey, "thumb"),
  }));
}
