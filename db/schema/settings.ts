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

/**
 * Marca de agua — RF-39, TECHNICAL-SPEC §9.6.
 *
 * **Tabla propia y no una columna de `site_settings`.** Esa fila la crea la
 * configuración con un WhatsApp y un email que ninguna migración puede
 * inventar, y el interruptor no los tiene: sin fila, prender la marca no
 * tendría dónde escribirse. Acá la fila se crea con el primer cambio.
 * Sin fila, la marca está apagada.
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

/**
 * La biblioteca de marcas de agua: imágenes con transparencia, guardadas una
 * sola vez en WEBP sin pérdida (§9.6). Quedan hasta que se borran a mano.
 */
export const watermarkImages = pgTable("watermark_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** La CLAVE en Storage, sin sufijo (§9.4). */
  storageKey: text("storage_key").notNull(),
  /** El nombre del archivo que se subió, para reconocerla en la lista. */
  name: text("name").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

/**
 * Las capas de la marca, en orden: la primera queda abajo. Borrar la imagen
 * se lleva sus capas (el panel avisa antes).
 */
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
export type LegalPage = typeof legalPages.$inferSelect;
