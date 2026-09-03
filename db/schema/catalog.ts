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

/** Catálogo — TECHNICAL-SPEC §5.4. */

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /**
     * La CLAVE del logo en Storage, no su URL (§9.4). Guardar la URL ataría
     * la fila al servidor del día que se escribió: el logo cargado en local
     * seguiría apuntando a `127.0.0.1` en producción. La URL se arma al
     * mostrar, con el backend que corresponda.
     */
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
    // Búsqueda tolerante a acentos y errores de tipeo (§5.10, RF-02).
    index("brands_name_trgm_idx").using(
      "gin",
      sql`immutable_unaccent(lower(${t.name})) gin_trgm_ops`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /**
     * RF-18: la categoría se muestra primero en el encabezado, en la home y
     * en el filtro del listado. Es una BANDERA, no un orden: entre destacadas
     * desempata el nombre (§5.4). Destacar no publica — `isActive` sigue
     * siendo la única verdad sobre la visibilidad.
     */
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("categories_name_key").on(sql`lower(${t.name})`)],
);

/**
 * Afinidad entre categorías (RF-31).
 * Una fila POR SENTIDO: la reciprocidad se materializa como dos filas, no
 * como una bandera que haya que interpretar al consultar (§11.1).
 */
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
    check(
      "no_self_relation",
      sql`${t.categoryId} <> ${t.relatedCategoryId}`,
    ),
  ],
);

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
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /** RF-15: Markdown acotado. La vendedora nunca ve la sintaxis (§5.4). */
    description: text("description").notNull().default(""),
    /**
     * Columna GENERADA, igual que `finalPrice`: la proyección en texto plano
     * de la descripción, SOLO para buscar (§10.1). Se calcula en la base para
     * que sea imposible que la consulta y el contenido discrepen.
     *
     * Se quitan `* _ # \``, que es la sintaxis que parte una subcadena:
     * `%cable hdmi%` no encuentra `Cable **HDMI**`. El guion NO se quita,
     * porque «USB-C» tiene que seguir siendo «USB-C».
     *
     * NO SE MUESTRA NUNCA. Si una descripción con `XT_500` pierde el guion
     * bajo, afecta a qué encuentra la búsqueda, jamás a lo que el comprador lee.
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
    /** RN-04b: el descuento es un MONTO, no un porcentaje. */
    discount: numeric("discount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    /**
     * Columna GENERADA: el precio final se calcula en la base, nunca en
     * JavaScript. Así filtrar y ordenar por precio con descuento (RF-02) es
     * un índice y no un cálculo por fila, y es imposible que la vista y la
     * consulta discrepen.
     */
    finalPrice: numeric("final_price", { precision: 12, scale: 2 })
      .generatedAlwaysAs(sql`price - discount`),
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
    // Búsqueda tolerante (§5.10, RF-02).
    index("products_name_trgm_idx").using(
      "gin",
      sql`immutable_unaccent(lower(${t.name})) gin_trgm_ops`,
    ),
    // Sobre la PROYECCIÓN, no sobre `description`: §10.1 busca en
    // `description_text` y un índice sobre la columna con sintaxis no lo
    // usaría nunca.
    index("products_description_trgm_idx").using(
      "gin",
      sql`immutable_unaccent(lower(${t.descriptionText})) gin_trgm_ops`,
    ),
    // Filtros y orden del catálogo (RF-02). Los índices son PARCIALES: el
    // sitio público nunca consulta productos inactivos (RN-05), así que el
    // índice solo indexa lo que se consulta.
    index("products_active_category_idx")
      .on(t.categoryId)
      .where(sql`is_active`),
    index("products_active_brand_idx").on(t.brandId).where(sql`is_active`),
    index("products_final_price_idx")
      .on(t.finalPrice)
      .where(sql`is_active`),
    index("products_created_idx")
      .on(t.createdAt.desc())
      .where(sql`is_active`),
  ],
);

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
    /**
     * SIN check de no-negatividad, a propósito (§5.4). RF-24 exige que la
     * vendedora pueda registrar una venta ya ocurrida aunque el sistema crea
     * que no hay stock: bloquearla la obligaría a mentirle al sistema. Un
     * total negativo es una SEÑAL DE DISCREPANCIA, se destaca en el panel y
     * se corrige con un ajuste.
     */
    stockTotal: integer("stock_total").notNull().default(0),
    reservedStock: integer("reserved_stock").notNull().default(0),
    /** RF-16: reutilizar las imágenes de otra variante. Un solo salto. */
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
    // La reserva nunca es negativa, en ninguna circunstancia.
    check("reserved_not_negative", sql`${t.reservedStock} >= 0`),
    // Y no supera al total MIENTRAS el total no sea negativo. La guarda no es
    // un descuido: sin ella, junto con la restricción de arriba, implicaría
    // `stock_total >= 0` e impondría el CHECK que §5.4 decidió NO poner,
    // rompiendo RF-24. Ver el recuadro de §5.4.
    check(
      "reserved_within_total",
      sql`${t.stockTotal} < 0 OR ${t.reservedStock} <= ${t.stockTotal}`,
    ),
    check("images_source_not_self", sql`${t.imagesSourceId} <> ${t.id}`),
    // Un color por producto. El COALESCE hace que la variante única
    // (color_id NULL) también quede sujeta a la unicidad.
    uniqueIndex("variant_product_color_key").on(
      t.productId,
      sql`COALESCE(${t.colorId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
  ],
);

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("variant_images_variant_idx").on(t.variantId, t.sortOrder),
  ],
);

export type Brand = typeof brands.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Color = typeof colors.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type VariantImage = typeof variantImages.$inferSelect;
