import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ConfiguracionDelSitio } from "@/modules/settings/queries";

/**
 * La escritura de la configuración del sitio — RF-20, §5.9, §4.
 *
 * Vive fuera de `actions.ts` por un motivo concreto: es lo único de F2.7 que
 * no se puede comprobar leyéndolo, y una Server Action no se puede llamar
 * desde un script —necesita sesión, cookies y un pedido—. Acá, en cambio,
 * `db:configuracion` corre EXACTAMENTE esta sentencia. La alternativa era que
 * el script se copiara el SQL, y entonces no probaría el código que se
 * ejecuta en producción sino que Postgres sabe hacer `ON CONFLICT`.
 *
 * La acción sigue siendo la puerta: rol, validación y revalidación son suyos
 * (§6.2). Esto es solo la escritura.
 */

/**
 * Un UPSERT y no un UPDATE.
 *
 * La fila no la crea ninguna migración —`whatsapp_number` y
 * `admin_notification_email` son NOT NULL y no hay valor que una migración
 * pueda inventar—, así que la primera vez que la vendedora guarda es también
 * la primera vez que la fila existe. Con un UPDATE, esa primera vez no
 * afectaría ninguna fila y la pantalla diría «guardado» sin haber guardado
 * nada: el peor final posible para un formulario.
 *
 * El `id = 1` va escrito y no dejado al DEFAULT: es lo que le da al
 * `ON CONFLICT` contra qué chocar. El CHECK `singleton` garantiza que no
 * pueda haber una segunda fila; esto garantiza que tampoco lo intentemos.
 *
 * `updated_at` se pisa a mano porque su DEFAULT solo corre al insertar.
 */
export async function escribirLaConfiguracion(
  entrada: ConfiguracionDelSitio,
): Promise<ConfiguracionDelSitio> {
  const [fila] = await db.execute<ConfiguracionDelSitio>(sql`
    INSERT INTO site_settings
           (id, whatsapp_number, admin_notification_email, low_stock_threshold)
    VALUES (1, ${entrada.whatsappNumber}, ${entrada.adminNotificationEmail},
            ${entrada.lowStockThreshold})
    ON CONFLICT (id) DO UPDATE
       SET whatsapp_number          = EXCLUDED.whatsapp_number,
           admin_notification_email = EXCLUDED.admin_notification_email,
           low_stock_threshold      = EXCLUDED.low_stock_threshold,
           updated_at               = now()
    RETURNING whatsapp_number          AS "whatsappNumber",
              admin_notification_email AS "adminNotificationEmail",
              low_stock_threshold      AS "lowStockThreshold"`);

  return fila;
}

/**
 * Prender o apagar el modo mantenimiento — F2.7b.
 *
 * **Un UPDATE, y acá sí es lo correcto**, al revés que la configuración: la
 * fila la crea el formulario de arriba con los dos datos que ninguna migración
 * puede inventar, y el interruptor no los tiene. Sin fila devuelve `null`, y
 * la acción lo traduce en «guardá primero la configuración». Crear la fila
 * desde acá obligaría a inventar un WhatsApp y un email.
 *
 * El UPSERT de `escribirLaConfiguracion` no nombra esta columna, y es a
 * propósito: guardar el número de WhatsApp no puede reabrir la tienda. Hay un
 * test que lo cuida.
 */
export async function escribirElModoMantenimiento(
  activo: boolean,
): Promise<boolean | null> {
  const [fila] = await db.execute<{ activo: boolean }>(sql`
    UPDATE site_settings
       SET maintenance_mode = ${activo},
           updated_at       = now()
     WHERE id = 1
    RETURNING maintenance_mode AS activo`);

  return fila?.activo ?? null;
}
