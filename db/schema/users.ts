import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Perfil de usuario (TECHNICAL-SPEC §5.3). La identidad vive en `auth.users`,
 * que administra GoTrue: ESE ESQUEMA NO SE TOCA NI SE LEE CON DRIZZLE.
 *
 * El perfil lo crea nuestro código con compensación (§13.4), jamás un
 * trigger: un trigger que falla bloquea los registros.
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    // Sin .references(): la clave foránea a auth.users(id) está en la
    // migración, escrita a mano.
    id: uuid("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /** Generada: no puede desincronizarse de las dos de arriba. */
    fullName: text("full_name")
      .notNull()
      .generatedAlwaysAs(sql`btrim(first_name || ' ' || last_name)`),
    /** Copia, para listar y buscar sin cruzar al esquema auth. */
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    role: text("role").notNull().default("customer"),
    /**
     * CLAVE en Storage, no URL: `usuarios/{id}/{imageId}`. Sin foto, se
     * dibuja un blobatar.
     */
    avatarKey: text("avatar_key"),

    isBanned: boolean("is_banned").notNull().default(false),
    banReason: text("ban_reason"),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    bannedBy: uuid("banned_by").references((): AnyPgColumn => userProfiles.id, {
      onDelete: "set null",
    }),

    /** La baja pedida (RF-34). Ejecutada no se borra: se suma `closed_at`. */
    closureRequestedAt: timestamp("closure_requested_at", {
      withTimezone: true,
    }),
    closureReason: text("closure_reason"),

    /** La baja ejecutada, separada del pedido y de `is_banned` (§13.5b). */
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references((): AnyPgColumn => userProfiles.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("role_valid", sql`${t.role} IN ('admin', 'customer')`),
    // RF-27: motivo obligatorio, garantizado por la base.
    check(
      "ban_has_reason",
      sql`NOT ${t.isBanned} OR ${t.banReason} IS NOT NULL`,
    ),
    // RF-34: ídem para la baja.
    check(
      "closure_has_reason",
      sql`${t.closureRequestedAt} IS NULL OR ${t.closureReason} IS NOT NULL`,
    ),
    // La baja ejecutada nace siempre de un pedido; para sacar a alguien por
    // decisión propia está el bloqueo (RF-27).
    check(
      "closed_was_requested",
      sql`${t.closedAt} IS NULL OR ${t.closureRequestedAt} IS NOT NULL`,
    ),
    index("user_profiles_email_idx").on(sql`lower(${t.email})`),
  ],
).enableRLS();

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

export type Role = "admin" | "customer";

/**
 * Lo que le pasó a una cuenta (§13.5); `user_profiles` dice cómo está hoy.
 * Desbloquear o revertir una baja limpia los motivos, y el rastro queda acá.
 */
export const userStatusHistory = pgTable(
  "user_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    /** En la fila de la baja, el que escribió el comprador al pedirla. */
    reason: text("reason"),
    actorUserId: uuid("actor_user_id").references(
      (): AnyPgColumn => userProfiles.id,
      { onDelete: "set null" },
    ),
    // clock_timestamp() y no now(): now() repite la hora en toda la
    // transacción y dos filas quedarían sin orden.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    check(
      "user_event_valid",
      sql`${t.event} IN ('bloqueo', 'desbloqueo', 'baja', 'reversion_de_baja')`,
    ),
    index("user_status_history_user_idx").on(t.userId, t.createdAt.desc()),
  ],
).enableRLS();

export type UserStatusEvent =
  "bloqueo" | "desbloqueo" | "baja" | "reversion_de_baja";
export type UserStatusHistoryRow = typeof userStatusHistory.$inferSelect;
