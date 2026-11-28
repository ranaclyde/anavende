import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { getSiteUrl } from "@/lib/env";
import { domainError } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { borrarArchivosDeFoto } from "@/modules/media/subir";
import { contarAdministradoras } from "@/modules/users/panel/queries";
import type { RolAsignable } from "@/modules/users/panel/schemas";

// Cuentas ajenas: todo va por el cliente de servicio. No hay «eliminar
// usuario» a propósito (§5.6): `orders.user_id` es `RESTRICT`.

const NUEVA_CONTRASENA = "/recuperar/nueva-contrasena";

function urlDeContrasenaNueva(): string {
  return `${getSiteUrl()}/api/auth/confirmar?next=${encodeURIComponent(
    NUEVA_CONTRASENA,
  )}`;
}

export type DatosDeAlta = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rol: RolAsignable;
};

/** Si el perfil falla, se borra la identidad: los dos o ninguno (§13.4). */
export async function invitarUsuario(
  datos: DatosDeAlta,
): Promise<{ id: string }> {
  const [existente] = await db.execute<{ id: string }>(sql`
    SELECT id FROM user_profiles WHERE lower(email) = lower(${datos.email})`);

  if (existente) throw emailRepetido();

  const servicio = createServiceClient();
  const { data, error } = await servicio.auth.admin.inviteUserByEmail(
    datos.email,
    {
      data: {
        full_name: `${datos.firstName} ${datos.lastName}`,
        first_name: datos.firstName,
      },
      // E3 no usa este destino (ver `lib/email/generate.mts`); se manda igual.
      redirectTo: urlDeContrasenaNueva(),
    },
  );

  if (error || !data?.user) {
    // Una identidad sin perfil (alta social a medias) no la ve la consulta
    // de arriba.
    if (error?.code === "email_exists" || error?.status === 422) {
      throw emailRepetido();
    }
    throw new Error(`inviteUserByEmail falló: ${error?.message}`);
  }

  try {
    await db.insert(userProfiles).values({
      id: data.user.id,
      firstName: datos.firstName,
      lastName: datos.lastName,
      email: datos.email,
      phone: datos.phone,
      role: datos.rol,
    });
  } catch (e) {
    await servicio.auth.admin.deleteUser(data.user.id);
    throw e;
  }

  return { id: data.user.id };
}

function emailRepetido() {
  return domainError("VALIDATION", {
    fields: {
      properties: {
        email: { errors: ["Ya hay una cuenta con ese email."] },
      },
    },
  });
}

export async function editarUsuario(datos: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<{ errorDeMetadatos: string | null }> {
  const filas = await db
    .update(userProfiles)
    .set({
      firstName: datos.firstName,
      lastName: datos.lastName,
      phone: datos.phone,
      updatedAt: sql`now()`,
    })
    .where(eq(userProfiles.id, datos.id))
    .returning({ id: userProfiles.id });

  if (filas.length === 0) throw domainError("NOT_FOUND");

  // Los emails de GoTrue saludan con `user_metadata`, no con el perfil.
  const { error } = await createServiceClient().auth.admin.updateUserById(
    datos.id,
    {
      user_metadata: {
        full_name: `${datos.firstName} ${datos.lastName}`,
        first_name: datos.firstName,
      },
    },
  );

  // No se falla por esto: el perfil ya se guardó. La acción lo reporta.
  return { errorDeMetadatos: error?.message ?? null };
}

/**
 * Además de RF-26 (no quitarse el rol a sí misma), no se le quita a la última
 * administradora: la tienda quedaría sin panel hasta un `UPDATE` a mano.
 */
export async function cambiarRolDeUsuario(datos: {
  id: string;
  rol: RolAsignable;
  actorId: string;
}): Promise<{ cambiado: boolean }> {
  const [usuario] = await db.execute<{ role: string }>(sql`
    SELECT role FROM user_profiles WHERE id = ${datos.id}`);

  if (!usuario) throw domainError("NOT_FOUND");

  if (usuario.role === datos.rol) return { cambiado: false };

  if (datos.id === datos.actorId) {
    throw domainError("FORBIDDEN", {
      message:
        "No podés cambiarte el rol a vos misma. Si querés dejar de ser " +
        "administradora, pedíselo a otra administradora.",
    });
  }

  if (usuario.role === "admin" && (await contarAdministradoras()) <= 1) {
    throw domainError("VALIDATION", {
      message:
        "Es la única administradora que queda. Nombrá a otra antes de " +
        "quitarle el rol: si no, nadie va a poder entrar al panel.",
    });
  }

  await db
    .update(userProfiles)
    .set({ role: datos.rol, updatedAt: sql`now()` })
    .where(eq(userProfiles.id, datos.id));

  return { cambiado: true };
}

/**
 * Por un cliente sin cookies: con el del servidor, el desafío PKCE quedaría
 * contra el navegador de la administradora y no el de quien abre el enlace.
 * Y con la clave de servicio, que GoTrue exime del captcha en `/recover`.
 */
export async function mandarRecuperacion(id: string): Promise<{
  email: string;
}> {
  const [usuario] = await db.execute<{
    email: string;
    isBanned: boolean;
    dadoDeBaja: boolean;
  }>(sql`
    SELECT email,
           is_banned AS "isBanned",
           closed_at IS NOT NULL AS "dadoDeBaja"
      FROM user_profiles WHERE id = ${id}`);

  if (!usuario) throw domainError("NOT_FOUND");

  if (usuario.isBanned || usuario.dadoDeBaja) {
    throw domainError("VALIDATION", {
      message: usuario.dadoDeBaja
        ? "Esa cuenta está dada de baja: revertí la baja primero y después " +
          "mandale el email."
        : "Esa cuenta está bloqueada: desbloqueala primero y después mandale " +
          "el email.",
    });
  }

  const { error } = await createServiceClient().auth.resetPasswordForEmail(
    usuario.email,
    {
      redirectTo: urlDeContrasenaNueva(),
    },
  );

  if (error) throw new Error(`resetPasswordForEmail falló: ${error.message}`);

  return { email: usuario.email };
}

/**
 * Primero la base y después GoTrue, y el orden no se cambia (§13.5): al revés,
 * un fallo de la base dejaría a alguien afuera sin motivo registrado. La
 * sesión abierta la cierra `proxy.ts`.
 */
export async function bloquearUsuario(datos: {
  id: string;
  motivo: string;
  actorId: string;
}): Promise<{ bloqueado: boolean; errorDeAuth: string | null }> {
  if (datos.id === datos.actorId) {
    throw domainError("FORBIDDEN", {
      message:
        "No podés bloquear tu propia cuenta: te dejaría afuera del panel en " +
        "la pantalla siguiente.",
    });
  }

  const yaEstaba = await db.transaction(async (tx) => {
    // Sin el `FOR NO KEY UPDATE`, dos pedidos a la vez escribirían dos filas
    // de historial.
    const [usuario] = await tx.execute<{
      role: string;
      isBanned: boolean;
      dadoDeBaja: boolean;
    }>(sql`
      SELECT role,
             is_banned AS "isBanned",
             closed_at IS NOT NULL AS "dadoDeBaja"
        FROM user_profiles
       WHERE id = ${datos.id}
         FOR NO KEY UPDATE`);

    if (!usuario) throw domainError("NOT_FOUND");
    if (usuario.isBanned) return true;

    // Las dos marcas juntas dejarían al ingreso sin saber qué mensaje dar.
    if (usuario.dadoDeBaja) {
      throw domainError("VALIDATION", {
        message:
          "Esa cuenta está dada de baja: ya no puede entrar, así que no hace " +
          "falta bloquearla.",
      });
    }

    if (usuario.role === "admin" && (await contarAdministradoras()) <= 1) {
      throw domainError("VALIDATION", {
        message:
          "Es la única administradora que queda. Nombrá a otra antes de " +
          "bloquearla: si no, nadie va a poder entrar al panel.",
      });
    }

    await tx.execute(sql`
      UPDATE user_profiles
         SET is_banned  = true,
             ban_reason = ${datos.motivo},
             banned_at  = now(),
             banned_by  = ${datos.actorId},
             updated_at = now()
       WHERE id = ${datos.id}`);

    await tx.execute(sql`
      INSERT INTO user_status_history (user_id, event, reason, actor_user_id)
      VALUES (${datos.id}, 'bloqueo', ${datos.motivo}, ${datos.actorId})`);

    return false;
  });

  if (yaEstaba) return { bloqueado: false, errorDeAuth: null };

  return {
    bloqueado: true,
    errorDeAuth: await sincronizarAuth(datos.id),
  };
}

export async function desbloquearUsuario(datos: {
  id: string;
  actorId: string;
}): Promise<{ desbloqueado: boolean; errorDeAuth: string | null }> {
  const estaba = await db.transaction(async (tx) => {
    const [usuario] = await tx.execute<{ isBanned: boolean }>(sql`
      SELECT is_banned AS "isBanned"
        FROM user_profiles
       WHERE id = ${datos.id}
         FOR NO KEY UPDATE`);

    if (!usuario) throw domainError("NOT_FOUND");
    if (!usuario.isBanned) return false;

    await tx.execute(sql`
      UPDATE user_profiles
         SET is_banned  = false,
             ban_reason = NULL,
             banned_at  = NULL,
             banned_by  = NULL,
             updated_at = now()
       WHERE id = ${datos.id}`);

    await tx.execute(sql`
      INSERT INTO user_status_history (user_id, event, actor_user_id)
      VALUES (${datos.id}, 'desbloqueo', ${datos.actorId})`);

    return true;
  });

  if (!estaba) return { desbloqueado: false, errorDeAuth: null };

  return { desbloqueado: true, errorDeAuth: await sincronizarAuth(datos.id) };
}

/**
 * Solo lo que el comprador pidió (`CHECK` `closed_was_requested`, §13.5b).
 * Mismo orden que el bloqueo: primero la base, después GoTrue. Se lleva la
 * foto, y revertir la baja no la trae.
 */
export async function ejecutarBaja(datos: {
  id: string;
  actorId: string;
}): Promise<{ ejecutada: boolean; errorDeAuth: string | null }> {
  const hecha = await db.transaction(async (tx) => {
    const [usuario] = await tx.execute<{
      pedida: boolean;
      yaEsta: boolean;
      motivo: string | null;
      foto: string | null;
    }>(sql`
      SELECT closure_requested_at IS NOT NULL AS pedida,
             closed_at            IS NOT NULL AS "yaEsta",
             closure_reason                   AS motivo,
             avatar_key                       AS foto
        FROM user_profiles
       WHERE id = ${datos.id}
         FOR NO KEY UPDATE`);

    if (!usuario) throw domainError("NOT_FOUND");
    if (usuario.yaEsta) return null;

    // Pudo retirarlo mientras la administradora miraba la ficha.
    if (!usuario.pedida) {
      throw domainError("INVALID_ORDER_STATE", {
        message:
          "Esa cuenta ya no tiene la baja pedida: la persona retiró el " +
          "pedido. Actualizá la página.",
      });
    }

    // En la misma sentencia que la marca: no hay cuenta dada de baja con foto.
    await tx.execute(sql`
      UPDATE user_profiles
         SET closed_at  = now(),
             closed_by  = ${datos.actorId},
             avatar_key = NULL,
             updated_at = now()
       WHERE id = ${datos.id}`);

    await tx.execute(sql`
      INSERT INTO user_status_history (user_id, event, reason, actor_user_id)
      VALUES (${datos.id}, 'baja', ${usuario.motivo}, ${datos.actorId})`);

    return { foto: usuario.foto };
  });

  if (!hecha) return { ejecutada: false, errorDeAuth: null };

  // Recién después del commit: antes, un rollback dejaría la foto rota.
  if (hecha.foto) await borrarArchivosDeFoto(hecha.foto);

  return {
    ejecutada: true,
    errorDeAuth: await sincronizarAuth(datos.id),
  };
}

/**
 * Limpia también el pedido y su motivo, o la cuenta volvería a solo lectura.
 * El motivo queda en la fila `baja` del historial.
 */
export async function revertirBaja(datos: {
  id: string;
  actorId: string;
}): Promise<{ revertida: boolean; errorDeAuth: string | null }> {
  const estaba = await db.transaction(async (tx) => {
    const [usuario] = await tx.execute<{ dadoDeBaja: boolean }>(sql`
      SELECT closed_at IS NOT NULL AS "dadoDeBaja"
        FROM user_profiles
       WHERE id = ${datos.id}
         FOR NO KEY UPDATE`);

    if (!usuario) throw domainError("NOT_FOUND");
    if (!usuario.dadoDeBaja) return false;

    await tx.execute(sql`
      UPDATE user_profiles
         SET closed_at            = NULL,
             closed_by            = NULL,
             closure_requested_at = NULL,
             closure_reason       = NULL,
             updated_at           = now()
       WHERE id = ${datos.id}`);

    await tx.execute(sql`
      INSERT INTO user_status_history (user_id, event, actor_user_id)
      VALUES (${datos.id}, 'reversion_de_baja', ${datos.actorId})`);

    return true;
  });

  if (!estaba) return { revertida: false, errorDeAuth: null };

  return { revertida: true, errorDeAuth: await sincronizarAuth(datos.id) };
}

/** Cien años: GoTrue guarda una fecha (`banned_until`), no un booleano. */
const SIN_VENCIMIENTO = "876000h";

/**
 * No recibe qué escribir: lo deduce del perfil, porque bloqueo y baja
 * comparten `ban_duration` (§13.5b) y escribir `none` a ciegas al desbloquear
 * le devolvería el ingreso a una cuenta dada de baja. No se reintenta: se
 * devuelve el error para que la pantalla lo diga (§13.5).
 */
async function sincronizarAuth(id: string): Promise<string | null> {
  const [perfil] = await db.execute<{ afuera: boolean }>(sql`
    SELECT is_banned OR closed_at IS NOT NULL AS afuera
      FROM user_profiles WHERE id = ${id}`);

  const { error } = await createServiceClient().auth.admin.updateUserById(id, {
    ban_duration: perfil?.afuera ? SIN_VENCIMIENTO : "none",
  });
  return error?.message ?? null;
}
