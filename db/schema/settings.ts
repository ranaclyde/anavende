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
 * WhatsApp, el email de avisos y el umbral de stock bajo.
 */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    whatsappNumber: text("whatsapp_number").notNull(),
    adminNotificationEmail: text("admin_notification_email").notNull(),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("singleton", sql`${t.id} = 1`)],
);

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** La CLAVE en Storage, no la URL — igual que el logo de marca (§9.4). */
  logoKey: text("logo_key"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

/** Garantías, términos, privacidad y cómo comprar (RF-29). Markdown. */
export const legalPages = pgTable("legal_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type LegalPage = typeof legalPages.$inferSelect;
