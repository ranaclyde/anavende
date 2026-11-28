import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Una sola fila, garantizada por el CHECK (RF-20). */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    whatsappNumber: text("whatsapp_number").notNull(),
    adminNotificationEmail: text("admin_notification_email").notNull(),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
    /** Lo lee `proxy.ts`; ver `modules/settings/mantenimiento.ts`. */
    maintenanceMode: boolean("maintenance_mode").notNull().default(false),
    /** Enlace completo y normalizado (`modules/settings/schemas.ts`). */
    facebookUrl: text("facebook_url"),
    instagramUrl: text("instagram_url"),
    /** Se encienden solas en su período (`lib/scenes.ts`); esto las apaga. */
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
  /** CLAVE en Storage, no URL (§9.4). */
  logoKey: text("logo_key"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();

/**
 * Promociones de cuotas (RF-40). Las fechas son `date` y se comparan contra el
 * día de Argentina, no contra un instante. Sin `ends_on`, no vence.
 */
export const paymentPromotions = pgTable(
  "payment_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentMethodId: uuid("payment_method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "cascade" }),
    /** «Plan Z» de Naranja X. `null` = la promoción es del medio entero. */
    planName: text("plan_name"),
    installments: integer("installments").notNull(),
    /** Fijo para el plan. `0` = sin interés. */
    surchargePct: numeric("surcharge_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    /** Sobre el precio final, con el descuento aplicado. `null` = sin mínimo. */
    minAmount: numeric("min_amount", { precision: 12, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payment_promotions_method_idx").on(t.paymentMethodId),
    check(
      "payment_promotions_installments",
      sql`${t.installments} BETWEEN 2 AND 48`,
    ),
    check(
      "payment_promotions_surcharge",
      sql`${t.surchargePct} >= 0 AND ${t.surchargePct} <= 200`,
    ),
    check(
      "payment_promotions_dates",
      sql`${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`,
    ),
    check(
      "payment_promotions_plan_name",
      sql`${t.planName} IS NULL OR char_length(${t.planName}) BETWEEN 1 AND 40`,
    ),
    check(
      "payment_promotions_min_amount",
      sql`${t.minAmount} IS NULL OR ${t.minAmount} > 0`,
    ),
  ],
).enableRLS();

/** Markdown (RF-29). */
export const legalPages = pgTable("legal_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

/**
 * Marca de agua (§9.6). Tabla propia: la fila de `site_settings` exige datos
 * que el interruptor no tiene. Sin fila, la marca está apagada.
 */
export const watermarkSettings = pgTable(
  "watermark_settings",
  {
    id: integer("id").primaryKey().default(1),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("watermark_settings_singleton", sql`${t.id} = 1`)],
).enableRLS();

/** Imágenes con transparencia, en WEBP sin pérdida (§9.6). */
export const watermarkImages = pgTable("watermark_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** CLAVE en Storage, sin sufijo (§9.4). */
  storageKey: text("storage_key").notNull(),
  /** El nombre del archivo que se subió. */
  name: text("name").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

/** En orden: la primera queda abajo. */
export const watermarkLayers = pgTable(
  "watermark_layers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    imageId: uuid("image_id")
      .notNull()
      .references(() => watermarkImages.id, { onDelete: "cascade" }),
    mode: text("mode", {
      enum: ["posicion", "cubrir", "estirar", "mosaico"],
    }).notNull(),
    anchor: text("anchor", {
      enum: [
        "arriba-izquierda",
        "arriba",
        "arriba-derecha",
        "izquierda",
        "centro",
        "derecha",
        "abajo-izquierda",
        "abajo",
        "abajo-derecha",
      ],
    })
      .notNull()
      .default("abajo-derecha"),
    sizePct: integer("size_pct").notNull().default(20),
    marginPct: integer("margin_pct").notNull().default(3),
    opacityPct: integer("opacity_pct").notNull().default(50),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    check(
      "watermark_layers_mode",
      sql`${t.mode} IN ('posicion', 'cubrir', 'estirar', 'mosaico')`,
    ),
    check(
      "watermark_layers_anchor",
      sql`${t.anchor} IN ('arriba-izquierda', 'arriba', 'arriba-derecha', 'izquierda', 'centro', 'derecha', 'abajo-izquierda', 'abajo', 'abajo-derecha')`,
    ),
    check("watermark_layers_size", sql`${t.sizePct} BETWEEN 5 AND 100`),
    check("watermark_layers_margin", sql`${t.marginPct} BETWEEN 0 AND 20`),
    check("watermark_layers_opacity", sql`${t.opacityPct} BETWEEN 5 AND 100`),
  ],
).enableRLS();

export type SiteSettings = typeof siteSettings.$inferSelect;
export type WatermarkImage = typeof watermarkImages.$inferSelect;
export type WatermarkLayer = typeof watermarkLayers.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type PaymentPromotion = typeof paymentPromotions.$inferSelect;
export type LegalPage = typeof legalPages.$inferSelect;
