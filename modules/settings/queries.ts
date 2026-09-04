import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { urlDeLogo } from "@/modules/media/subir";

/**
 * Configuración del sitio — RF-20, §5.9.
 *
 * La tabla es un singleton garantizado por CHECK, y la fila puede NO
 * existir: **no la escribe ninguna migración, la escribe la vendedora** la
 * primera vez que guarda la pantalla de configuración (F2.7). No podría ser
 * de otra manera: sus dos columnas de texto son NOT NULL y no hay número de
 * WhatsApp ni email que una migración pueda inventar. Así que el respaldo
 * del umbral no era algo provisorio de F2.5: es permanente.
 */

/**
 * El mismo `3` que declara `DEFAULT` en la columna (§5.9).
 *
 * Está repetido a propósito y no derivado: la base decide el valor de la
 * fila nueva, y este decide qué pasa cuando NO hay fila. Son dos preguntas
 * distintas que hoy tienen la misma respuesta.
 *
 * También es lo que la pantalla de configuración muestra en el campo antes
 * de la primera vez, y eso importa: si ofreciera otro número, guardar sin
 * tocar nada cambiaría el comportamiento del listado sin que nadie lo
 * hubiera pedido.
 */
export const UMBRAL_DE_STOCK_BAJO_POR_DEFECTO = 3;

export async function umbralDeStockBajo(): Promise<number> {
  const [fila] = await db.execute<{ umbral: number }>(sql`
    SELECT low_stock_threshold AS umbral FROM site_settings WHERE id = 1
  `);
  return fila?.umbral ?? UMBRAL_DE_STOCK_BAJO_POR_DEFECTO;
}

export type ConfiguracionDelSitio = {
  /** Normalizado a `+549…` (`lib/telefono.ts`). */
  whatsappNumber: string;
  adminNotificationEmail: string;
  lowStockThreshold: number;
};

/**
 * La configuración entera, para la pantalla que la edita.
 *
 * Devuelve `null` —y no valores de relleno— cuando todavía no se guardó
 * nunca. Es la diferencia entre «acá dice 3 porque lo elegiste» y «acá dice
 * 3 porque es lo que usa el sistema mientras no elijas»: quien lo tiene que
 * distinguir es la pantalla, y con un objeto ya rellenado no podría.
 */
export async function leerLaConfiguracion(): Promise<ConfiguracionDelSitio | null> {
  const [fila] = await db.execute<ConfiguracionDelSitio>(sql`
    SELECT whatsapp_number           AS "whatsappNumber",
           admin_notification_email  AS "adminNotificationEmail",
           low_stock_threshold       AS "lowStockThreshold"
      FROM site_settings
     WHERE id = 1
  `);
  return fila ?? null;
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
