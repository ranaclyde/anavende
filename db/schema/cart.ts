import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
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

/** Carrito, direcciones y favoritos — TECHNICAL-SPEC §5.5. */

/**
 * EL CARRITO NO EXISTE SIN SESIÓN (RF-08): no hay tabla ni cookie de carrito
 * anónimo. Un carrito por usuario, garantizado por el UNIQUE.
 */
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
});

/**
 * Guarda CANTIDAD, nunca precio: el precio se lee del producto en el momento
 * de mostrar (RN-09). Un precio congelado en el carrito es un precio que se
 * cobra mal.
 */
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
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("cart_items_cart_variant_key").on(t.cartId, t.variantId),
    check("quantity_positive", sql`${t.quantity} > 0`),
  ],
);

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
    postalCode: text("postal_code").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    /** Baja lógica: una orden vieja tiene que poder seguir mostrándose. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // «Hay una sola dirección predeterminada» es una GARANTÍA DE LA BASE, no
    // una convención que la aplicación deba recordar (§5.5).
    uniqueIndex("one_default_address_per_user")
      .on(t.userId)
      .where(sql`is_default AND deleted_at IS NULL`),
  ],
);

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
);

export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
