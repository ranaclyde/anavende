import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { productVariants } from "./catalog";
import { orderOrigin, orderStatus } from "./enums";
import { userProfiles } from "./users";

/** Órdenes — TECHNICAL-SPEC §5.6. */

/** Snapshot de la dirección de envío (RN-12). */
export type ShippingAddressSnapshot = {
  recipientName: string;
  phone: string;
  street: string;
  number: string;
  apartment?: string | null;
  notes?: string | null;
  city: string;
  province: string;
  postalCode: string;
};

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lo que ve la gente. Arranca en 1000 para no parecer la orden n.º 1. */
    orderNumber: integer("order_number")
      .notNull()
      .unique()
      .generatedByDefaultAsIdentity({ startWith: 1000 }),
    /** NULL en órdenes manuales de alguien sin cuenta (RF-24). */
    userId: uuid("user_id").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    status: orderStatus("status").notNull().default("activa"),
    origin: orderOrigin("origin").notNull().default("web"),

    // Snapshot del comprador (RN-12): la orden se lee igual dentro de un año,
    // aunque la persona haya cambiado su teléfono o borrado la cuenta.
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone").notNull(),
    shippingAddress: jsonb(
      "shipping_address",
    ).$type<ShippingAddressSnapshot | null>(),

    /** SUM(order_items.subtotal), calculado en SQL dentro de la transacción. */
    total: numeric("total", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),

    /** La administradora, en las órdenes manuales. */
    createdBy: uuid("created_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    check("total_not_negative", sql`${t.total} >= 0`),
    // Una orden de la web sin usuario sería un comprador fantasma.
    check(
      "web_order_has_user",
      sql`${t.origin} <> 'web' OR ${t.userId} IS NOT NULL`,
    ),
    index("orders_status_idx").on(t.status, t.createdAt.desc()),
    index("orders_user_idx").on(t.userId, t.createdAt.desc()),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Se pone en NULL si la variante desaparece: el snapshot sobrevive. */
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),

    // Snapshot (RN-12): la orden se lee igual aunque el catálogo cambie.
    productName: text("product_name").notNull(),
    brandName: text("brand_name").notNull(),
    colorName: text("color_name"),
    /**
     * El precio final YA CON DESCUENTO al momento de crear la orden. No se
     * guarda el descuento por separado: la orden registra lo que se acordó
     * cobrar, no cómo se llegó a ese número (§5.6).
     */
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 })
      .generatedAlwaysAs(sql`unit_price * quantity`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("item_quantity_positive", sql`${t.quantity} > 0`),
    check("item_price_not_negative", sql`${t.unitPrice} >= 0`),
    index("order_items_order_idx").on(t.orderId),
  ],
);

/** Cada transición de estado deja rastro, con autor y motivo (RF-13). */
export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: orderStatus("from_status"),
  toStatus: orderStatus("to_status").notNull(),
  reason: text("reason"),
  actorUserId: uuid("actor_user_id").references(() => userProfiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatusHistoryRow = typeof orderStatusHistory.$inferSelect;
