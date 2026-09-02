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
 * Libro mayor de stock — TECHNICAL-SPEC §5.8.
 *
 * Es la tabla que responde «¿por qué esta variante tiene este stock?» cuando
 * el número no cuadre, que es la pregunta que inevitablemente aparece en
 * producción.
 *
 * SE ESCRIBE EN LA MISMA TRANSACCIÓN QUE EL CAMBIO DE STOCK, SIN EXCEPCIÓN
 * (§8.3). Un asiento que se escribe «después» es un asiento que un día no se
 * escribe, y ahí se pierde la única forma de auditar la discrepancia.
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
    /** stock_total resultante, para poder cuadrar el libro (F4.6). */
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("stock_movements_variant_idx").on(t.variantId, t.createdAt.desc()),
  ],
);

export type StockMovement = typeof stockMovements.$inferSelect;
