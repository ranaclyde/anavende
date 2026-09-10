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
 * Perfil de usuario — TECHNICAL-SPEC §5.3.
 *
 * La identidad (email, hash de contraseña, verificación, identidades de
 * Google y Facebook, banned_until) vive en `auth.users`, que administra
 * GoTrue. ESE ESQUEMA NO SE TOCA NI SE LEE CON DRIZZLE.
 *
 * Todas las tablas de dominio referencian `user_profiles(id)`, nunca
 * `auth.users`: así el esquema de la aplicación es autocontenido.
 *
 * El perfil lo crea nuestro código con compensación explícita (§13.4),
 * jamás un trigger: un trigger que falla bloquea los registros.
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    // Sin .references(): apunta a auth.users(id), que Drizzle no administra.
    // La clave foránea se declara en la migración a mano (F1.6).
    id: uuid("id").primaryKey(),
    /**
     * Nombre y apellido POR SEPARADO, y no un campo libre — decisión del
     * 2026-09-10.
     *
     * El campo único obligaba a adivinar cuál era cuál, y esa adivinanza ya
     * estaba escrita: el alta partía el nombre por el primer espacio para
     * saludar en los emails. Con «Sanhueza, Matías» —que es como mucha gente
     * escribe— el email salía «Hola, Sanhueza,». Se pregunta separado porque
     * separado es como se usa.
     *
     * El apellido acepta varias palabras a propósito: dos apellidos son
     * normales y no son un error de tipeo.
     */
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /**
     * Columna GENERADA: es el nombre para mostrar, y se escribe sola.
     *
     * Existe para que todo lo que ya lo lee —el encabezado, el saludo de «Mi
     * cuenta», el menú del panel— siga funcionando sin cambiar una línea, y
     * sobre todo para que no pueda desincronizarse de las dos columnas de
     * arriba. Un `full_name` mantenido por la aplicación es una tercera copia
     * que algún día alguien actualiza a medias.
     */
    fullName: text("full_name")
      .notNull()
      .generatedAlwaysAs(sql`btrim(first_name || ' ' || last_name)`),
    /** Copia, para listar y buscar sin cruzar al esquema auth. */
    email: text("email").notNull(),
    /** RF-05: obligatorio, en las tres vías de alta. */
    phone: text("phone").notNull(),
    role: text("role").notNull().default("customer"),

    // RF-27: el motivo de bloqueo no existe en Supabase Auth. Es nuestro.
    isBanned: boolean("is_banned").notNull().default(false),
    banReason: text("ban_reason"),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    bannedBy: uuid("banned_by").references((): AnyPgColumn => userProfiles.id, {
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
    // RF-27 exige motivo obligatorio. Un CHECK lo vuelve imposible de
    // olvidar, en vez de confiar en que todo camino del código se acuerde.
    check(
      "ban_has_reason",
      sql`NOT ${t.isBanned} OR ${t.banReason} IS NOT NULL`,
    ),
    index("user_profiles_email_idx").on(sql`lower(${t.email})`),
  ],
);

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

/** Los dos únicos roles del sistema (§5.3). */
export type Role = "admin" | "customer";
