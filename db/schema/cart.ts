import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { products, productVariants } from "./catalog";
import { userProfiles } from "./users";

/** EL CARRITO NO EXISTE SIN SESIÓN (RF-08). */
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

/** Guarda CANTIDAD, nunca precio: el precio se lee al mostrar (RN-09). */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    /** Lo que el comprador VIO, para avisar si cambió. NUNCA se cobra. */
    lastSeenPrice: numeric("last_seen_price", {
      precision: 12,
      scale: 2,
    }).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("cart_items_cart_variant_key").on(t.cartId, t.variantId),
    check("quantity_positive", sql`${t.quantity} > 0`),
  ],
).enableRLS();

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    street: text("street").notNull(),
    number: text("number").notNull(),
    apartment: text("apartment"),
    notes: text("notes"),
    city: text("city").notNull(),
    province: text("province").notNull(),
    /** Se deduce de la localidad; `null` en «Otra localidad cercana». */
    postalCode: text("postal_code"),
    isDefault: boolean("is_default").notNull().default(false),
    /** Baja lógica: una orden vieja tiene que poder seguir mostrándose. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Una sola predeterminada por usuario, garantizado por la base.
    uniqueIndex("one_default_address_per_user")
      .on(t.userId)
      .where(sql`is_default AND deleted_at IS NULL`),
  ],
).enableRLS();

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
).enableRLS();

export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
