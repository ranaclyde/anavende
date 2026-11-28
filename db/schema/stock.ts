import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { productVariants } from "./catalog";
import { stockMovementType } from "./enums";
import { orders } from "./orders";
import { returns } from "./returns";
import { userProfiles } from "./users";

/**
 * Libro mayor de stock (§5.8). SE ESCRIBE EN LA MISMA TRANSACCIÓN QUE EL
 * CAMBIO DE STOCK, SIN EXCEPCIÓN (§8.3).
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    type: stockMovementType("type").notNull(),
    /** Con signo, según el efecto del movimiento. */
    quantity: integer("quantity").notNull(),
    /** stock_total resultante, para poder cuadrar el libro. */
    stockAfter: integer("stock_after").notNull(),
    /** reserved_stock resultante. */
    reservedAfter: integer("reserved_after").notNull(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    returnId: uuid("return_id").references(() => returns.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    // clock_timestamp() y no now(): now() es el inicio de la transacción, y
    // dos movimientos de una misma transacción quedarían sin orden.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("stock_movements_variant_idx").on(t.variantId, t.createdAt.desc()),
  ],
).enableRLS();

export type StockMovement = typeof stockMovements.$inferSelect;
