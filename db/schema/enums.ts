import { pgEnum } from "drizzle-orm/pg-core";

/** Tipos enumerados — TECHNICAL-SPEC §5.2. */

export const orderStatus = pgEnum("order_status", [
  "activa",
  "finalizada",
  "cancelada",
]);

export const orderOrigin = pgEnum("order_origin", ["web", "manual"]);

export const returnStatus = pgEnum("return_status", [
  "registrada",
  "anulada",
]);

export const stockMovementType = pgEnum("stock_movement_type", [
  "ajuste", // carga o corrección manual de stock
  "reserva", // orden pasa a activa
  "liberacion", // orden cancelada o ítem quitado
  "venta", // orden finalizada
  "devolucion", // devolución con reposición
]);
