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
    /**
     * `clock_timestamp()`, NO `now()` — y es la diferencia entre tener orden
     * y no tenerlo (F4.1, 2026-09-06).
     *
     * `now()` devuelve el momento en que ARRANCÓ la transacción y no se mueve
     * hasta que termina, así que varios movimientos escritos en la misma
     * transacción —reservar y vender, o los dos ítems de una devolución—
     * quedan con el timestamp idéntico. Con el índice `(variant_id,
     * created_at DESC)` de §5.8 eso significa que el libro los devuelve en un
     * orden cualquiera, y el libro existe justamente para reconstruir qué
     * pasó y en qué orden.
     *
     * `clock_timestamp()` avanza sentencia a sentencia. Además es lo que un
     * asiento de auditoría tiene que guardar: cuándo ocurrió el movimiento,
     * no cuándo alguien abrió la transacción que lo contiene.
     */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("stock_movements_variant_idx").on(t.variantId, t.createdAt.desc()),
  ],
);

export type StockMovement = typeof stockMovements.$inferSelect;
