import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /** CLAVE en Storage, no URL (§9.4): la URL se arma al mostrar. */
    logoKey: text("logo_key"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("brands_name_key").on(sql`lower(${t.name})`),
    index("brands_name_trgm_idx").using(
      "gin",
      sql`immutable_unaccent(lower(${t.name})) gin_trgm_ops`,
    ),
  ],
).enableRLS();

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /** Bandera, no orden (RF-18). Destacar no publica: eso es `isActive`. */
    isFeatured: boolean("is_featured").notNull().default(false),
    /** Clave en Storage, como `brands.logo_key`. */
    imageKey: text("image_key"),
    /** Texto plano; el tope está en `modules/catalog/schemas.ts`. */
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("categories_name_key").on(sql`lower(${t.name})`)],
).enableRLS();

/** Afinidad entre categorías (RF-31): una fila POR SENTIDO (§11.1). */
export const categoryRelations = pgTable(
  "category_relations",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    relatedCategoryId: uuid("related_category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    isReciprocal: boolean("is_reciprocal").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.relatedCategoryId] }),
    check("no_self_relation", sql`${t.categoryId} <> ${t.relatedCategoryId}`),
  ],
).enableRLS();

export const colors = pgTable(
  "colors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    hexCode: text("hex_code").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("colors_name_key").on(sql`lower(${t.name})`)],
).enableRLS();

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    sku: text("sku"),
    /** SIN USO: reemplazada por `sku`. Se borra en otro cambio (TS §18.2). */
    model: text("model"),
    /** Markdown acotado (RF-15). */
    description: text("description").notNull().default(""),
    /**
     * Generada: la descripción sin la sintaxis que parte una subcadena
     * (`Cable **HDMI**`), SOLO para buscar (§10.1). NO SE MUESTRA NUNCA.
     */
    descriptionText: text("description_text").generatedAlwaysAs(
      sql`regexp_replace(description, '[*_#\`]', '', 'g')`,
    ),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    /** Un MONTO, no un porcentaje (RN-04b). */
    discount: numeric("discount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    /** Generada: se calcula en la base, nunca en JavaScript, y se indexa. */
    finalPrice: numeric("final_price", {
      precision: 12,
      scale: 2,
    }).generatedAlwaysAs(sql`price - discount`),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("price_positive", sql`${t.price} > 0`),
    check(
      "discount_valid",
      sql`${t.discount} >= 0 AND ${t.discount} < ${t.price}`,
    ),
    index("products_name_trgm_idx").using(
      "gin",
      sql`immutable_unaccent(lower(${t.name})) gin_trgm_ops`,
    ),
    // Sobre `description_text`, que es donde busca §10.1.
    index("products_description_trgm_idx").using(
      "gin",
      sql`immutable_unaccent(lower(${t.descriptionText})) gin_trgm_ops`,
    ),
    // Parciales: la tienda nunca consulta productos inactivos (RN-05).
    index("products_active_category_idx")
      .on(t.categoryId)
      .where(sql`is_active`),
    index("products_active_brand_idx")
      .on(t.brandId)
      .where(sql`is_active`),
    index("products_final_price_idx")
      .on(t.finalPrice)
      .where(sql`is_active`),
    index("products_created_idx")
      .on(t.createdAt.desc())
      .where(sql`is_active`),
    // Único dentro de la marca y sin distinguir mayúsculas.
    uniqueIndex("products_sku_key").on(t.brandId, sql`lower(${t.sku})`),
  ],
).enableRLS();

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** NULL = variante única, el producto no se vende por color. */
    colorId: uuid("color_id").references(() => colors.id, {
      onDelete: "restrict",
    }),
    /** «Negro/Rojo». Las pantallas leen la vista `variant_colors`. */
    secondaryColorId: uuid("secondary_color_id").references(() => colors.id, {
      onDelete: "restrict",
    }),
    /**
     * SIN check de no-negatividad, a propósito (§5.4, RF-24): un total
     * negativo es una señal de discrepancia, no un error.
     */
    stockTotal: integer("stock_total").notNull().default(0),
    reservedStock: integer("reserved_stock").notNull().default(0),
    /** Reutiliza las imágenes de otra variante (RF-16). Un solo salto. */
    imagesSourceId: uuid("images_source_id").references(
      (): AnyPgColumn => productVariants.id,
      { onDelete: "set null" },
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("reserved_not_negative", sql`${t.reservedStock} >= 0`),
    // La guarda `stock_total < 0` no es un descuido: sin ella esto implicaría
    // `stock_total >= 0`, el CHECK que §5.4 decidió NO poner.
    check(
      "reserved_within_total",
      sql`${t.stockTotal} < 0 OR ${t.reservedStock} <= ${t.stockTotal}`,
    ),
    check("images_source_not_self", sql`${t.imagesSourceId} <> ${t.id}`),
    check(
      "secondary_color_valid",
      sql`${t.secondaryColorId} IS NULL OR (${t.colorId} IS NOT NULL AND ${t.secondaryColorId} <> ${t.colorId})`,
    ),
    // Sin importar el orden: «Negro/Rojo» y «Rojo/Negro» son la misma. Los
    // COALESCE alcanzan también a la variante única y a la de un color.
    uniqueIndex("variant_product_color_key").on(
      t.productId,
      sql`LEAST(COALESCE(${t.colorId}, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(${t.secondaryColorId}, '00000000-0000-0000-0000-000000000000'::uuid))`,
      sql`GREATEST(COALESCE(${t.colorId}, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(${t.secondaryColorId}, '00000000-0000-0000-0000-000000000000'::uuid))`,
    ),
    index("variant_secondary_color_idx")
      .on(t.secondaryColorId)
      .where(sql`${t.secondaryColorId} IS NOT NULL`),
  ],
).enableRLS();

export const variantImages = pgTable(
  "variant_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    /** Base sin sufijo de tamaño; los tres tamaños se derivan (§9.2). */
    storageKey: text("storage_key").notNull(),
    altText: text("alt_text"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Quemada en la imagen (RF-39): no se puede sacar. */
    hasWatermark: boolean("has_watermark").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("variant_images_variant_idx").on(t.variantId, t.sortOrder)],
).enableRLS();

export type Brand = typeof brands.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Color = typeof colors.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type VariantImage = typeof variantImages.$inferSelect;
