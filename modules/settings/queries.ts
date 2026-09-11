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
 * El interruptor de mantenimiento como está EN LA BASE — F2.7b.
 *
 * Para la pantalla que lo cambia, que no puede mostrar lo que el proxy
 * recuerda: si dijera «abierta» cinco segundos después de cerrarla, parecería
 * que no se guardó. `null` = la configuración nunca se guardó y no hay fila
 * donde prenderlo.
 */
export async function elModoMantenimiento(): Promise<boolean | null> {
  const [fila] = await db.execute<{ activo: boolean }>(sql`
    SELECT maintenance_mode AS activo FROM site_settings WHERE id = 1
  `);
  return fila?.activo ?? null;
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

// ── Lo que la tienda necesita de la configuración ───────────────────────
//
// Consultas propias y no `leerLaConfiguracion()` recortada: esa devuelve
// también el email de aviso a la administradora, y una pantalla pública no
// tiene por qué traerse un dato interno a la memoria del servidor para
// después descartarlo.

/**
 * El número al que van los `wa.me` de la tienda — RF-20, F3.6.
 *
 * `null` mientras la vendedora no haya guardado la configuración, y eso pasa
 * de verdad: la fila no la escribe ninguna migración (§5.9). Quien lo use
 * tiene que poder no mostrar el botón, no armar un enlace roto — `wa.me/`
 * sin número abre WhatsApp en la nada y parece que el sitio falló.
 */
export async function numeroDeWhatsApp(): Promise<string | null> {
  const [fila] = await db.execute<{ numero: string }>(sql`
    SELECT whatsapp_number AS numero FROM site_settings WHERE id = 1
  `);
  return fila?.numero ?? null;
}

/** Un medio de pago como lo ve el comprador (RF-01, RF-02, RF-03). */
export type MedioDePagoDeLaTienda = {
  id: string;
  nombre: string;
  logoUrl: string | null;
};

/**
 * Los medios de pago **activos**, en el orden configurado — RF-19, RN-01.
 *
 * `listarMediosDePago()` es la del panel y trae también los desactivados,
 * porque ahí desactivar es un estado que se administra. Acá un desactivado
 * no existe: son informativos y decir que se acepta algo que no se acepta es
 * el peor de los dos errores posibles.
 */
export async function mediosDePagoDeLaTienda(): Promise<
  MedioDePagoDeLaTienda[]
> {
  const filas = await db.execute<{
    id: string;
    nombre: string;
    logoKey: string | null;
  }>(sql`
    SELECT id, name AS nombre, logo_key AS "logoKey"
      FROM payment_methods
     WHERE is_active
     ORDER BY sort_order, immutable_unaccent(lower(name))
  `);

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    logoUrl: urlDeLogo(f.logoKey, "thumb"),
  }));
}
