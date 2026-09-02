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

import { returnStatus } from "./enums";
import { orderItems, orders } from "./orders";
import { userProfiles } from "./users";

/** Devoluciones — TECHNICAL-SPEC §5.7, RF-25. */

export const returns = pgTable("returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  // RESTRICT: una orden con devoluciones no se borra.
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "restrict" }),
  status: returnStatus("status").notNull().default("registrada"),
  reason: text("reason").notNull(),
  voidReason: text("void_reason"),
  createdBy: uuid("created_by").references(() => userProfiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
});

export const returnItems = pgTable(
  "return_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    returnId: uuid("return_id")
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    /** false = producto defectuoso: no vuelve al stock (RF-25). */
    restocks: boolean("restocks").notNull(),
    reason: text("reason"),
  },
  (t) => [check("return_quantity_positive", sql`${t.quantity} > 0`)],
);

export type Return = typeof returns.$inferSelect;
export type ReturnItem = typeof returnItems.$inferSelect;
