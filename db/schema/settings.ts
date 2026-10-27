import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Configuración y contenido — TECHNICAL-SPEC §5.9. */

/**
 * Una sola fila, garantizada por el CHECK. Acá viven los valores que la
 * vendedora tiene que poder cambiar sin desplegar (RF-20): el número de
 * WhatsApp, el email de avisos, el umbral de stock bajo y las redes sociales.
 */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    whatsappNumber: text("whatsapp_number").notNull(),
    adminNotificationEmail: text("admin_notification_email").notNull(),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
    /**
     * Tienda fuera de servicio para el público, y normal para quien
     * administra (F2.7b). Lo lee `proxy.ts` en cada pedido que no sea de una
     * ruta que siempre pasa; ver `modules/settings/mantenimiento.ts`.
     */
    maintenanceMode: boolean("maintenance_mode").notNull().default(false),
    /**
     * Los perfiles que el pie de la tienda enlaza debajo del logo (2026-10-20).
     * Opcionales: `null` = esa red no se muestra. Se guardan como enlace
     * completo y normalizado (`modules/settings/schemas.ts`), así la tienda los
     * pone en un `href` sin armar nada.
     */
    facebookUrl: text("facebook_url"),
    instagramUrl: text("instagram_url"),
    /**
     * Las escenas por fecha (F9.5, RF-38). Se encienden solas en su período
     * (`lib/escenas.ts`), y esto es lo que deja apagarlas desde el panel.
     * `true` por defecto, igual que el respaldo sin fila: una fecha que no se
     * apagó a propósito se ve.
     */
    halloweenScene: boolean("halloween_scene").notNull().default(true),
    christmasScene: boolean("christmas_scene").notNull().default(true),
    easterScene: boolean("easter_scene").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("singleton", sql`${t.id} = 1`)],
).enableRLS();

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** La CLAVE en Storage, no la URL — igual que el logo de marca (§9.4). */
  logoKey: text("logo_key"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();

/** Garantías, términos, privacidad y cómo comprar (RF-29). Markdown. */
export const legalPages = pgTable("legal_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export type SiteSettings = typeof siteSettings.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type LegalPage = typeof legalPages.$inferSelect;
