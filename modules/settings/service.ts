import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ConfiguracionDelSitio } from "@/modules/settings/queries";

// Fuera de `actions.ts` para que `db:configuracion` corra esta misma sentencia:
// una Server Action no se puede llamar desde un script. Rol, validación y
// revalidación siguen siendo de la acción.

/**
 * UPSERT y no UPDATE: la fila no la crea ninguna migración, y la primera vez
 * que se guarda un UPDATE no tocaría nada y diría «guardado».
 *
 * `updated_at` se pisa a mano porque su DEFAULT solo corre al insertar.
 */
export async function escribirLaConfiguracion(
  entrada: ConfiguracionDelSitio,
): Promise<ConfiguracionDelSitio> {
  const [fila] = await db.execute<ConfiguracionDelSitio>(sql`
    INSERT INTO site_settings
           (id, whatsapp_number, admin_notification_email, low_stock_threshold,
            facebook_url, instagram_url, halloween_scene, christmas_scene,
            easter_scene)
    VALUES (1, ${entrada.whatsappNumber}, ${entrada.adminNotificationEmail},
            ${entrada.lowStockThreshold}, ${entrada.facebookUrl},
            ${entrada.instagramUrl}, ${entrada.halloweenScene},
            ${entrada.christmasScene}, ${entrada.easterScene})
    ON CONFLICT (id) DO UPDATE
       SET whatsapp_number          = EXCLUDED.whatsapp_number,
           admin_notification_email = EXCLUDED.admin_notification_email,
           low_stock_threshold      = EXCLUDED.low_stock_threshold,
           facebook_url             = EXCLUDED.facebook_url,
           instagram_url            = EXCLUDED.instagram_url,
           halloween_scene          = EXCLUDED.halloween_scene,
           christmas_scene          = EXCLUDED.christmas_scene,
           easter_scene             = EXCLUDED.easter_scene,
           updated_at               = now()
    RETURNING whatsapp_number          AS "whatsappNumber",
              admin_notification_email AS "adminNotificationEmail",
              low_stock_threshold      AS "lowStockThreshold",
              facebook_url             AS "facebookUrl",
              instagram_url            AS "instagramUrl",
              halloween_scene          AS "halloweenScene",
              christmas_scene          AS "christmasScene",
              easter_scene             AS "easterScene"`);

  return fila;
}

/**
 * UPDATE y no UPSERT: crear la fila desde acá obligaría a inventar un WhatsApp
 * y un email. Sin fila devuelve `null`.
 *
 * El UPSERT de arriba no nombra `maintenance_mode` a propósito: guardar la
 * configuración no puede reabrir la tienda (hay un test).
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
