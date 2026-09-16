import "server-only";

import { createClient as crearClienteSuelto } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { urlDelSitio } from "@/lib/env";
import { domainError } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { contarAdministradoras } from "@/modules/users/panel/queries";
import type { RolAsignable } from "@/modules/users/panel/schemas";

/**
 * Gestión de usuarios desde el panel — FS RF-26 · TS §13.2, §13.4. Tarea F7.6.
 *
 * **Es el único lugar de la aplicación que administra cuentas ajenas**, y por
 * eso todo pasa por el cliente de SERVICIO: crear una identidad, cambiarle los
 * metadatos o pedir una recuperación para otra persona no se puede hacer con
 * la sesión de quien lo pide.
 *
 * **No hay «eliminar usuario», y es a propósito** (§5.6, F4.5b): un comprador
 * con órdenes no se borra ni se puede borrar —`orders.user_id` es `RESTRICT`—.
 * Lo que existe es bloquear (RF-27, F7.7) y dar de baja (RF-34, F7.9).
 */

/** A dónde lleva el enlace de los emails que se disparan desde acá. */
const NUEVA_CONTRASENA = "/recuperar/nueva-contrasena";

function urlDeContrasenaNueva(): string {
  return `${urlDelSitio()}/api/auth/confirmar?next=${encodeURIComponent(
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

/**
 * Alta por invitación — RF-26: «crear usuario enviándole un email para definir
 * su contraseña».
 *
 * **Se invita, no se crea con contraseña.** `inviteUserByEmail` dispara E3
 * —la plantilla ya estaba escrita desde F1.8, esperando esta pantalla— y deja
 * que la persona elija su contraseña: la alternativa sería inventarle una y
 * mandársela por algún lado, que es peor de todas las maneras posibles.
 *
 * **El `first_name` va en los metadatos** porque es lo único con lo que los
 * emails de GoTrue saben saludar (`{{ .Data.first_name }}`). Sin eso, E3 llega
 * con «¡Hola!» a secas — la plantilla lo contempla, pero acá sí sabemos el
 * nombre.
 *
 * **Y si el perfil falla, se borra la identidad** (§13.4, paso 3): o quedan
 * los dos o ninguno. Una identidad sin perfil es alguien que puede entrar y
 * con quien la aplicación no sabe qué hacer.
 */
export async function invitarUsuario(
  datos: DatosDeAlta,
): Promise<{ id: string }> {
  // El email ya usado se contesta como error del campo y no como un fallo de
  // la plataforma: es el error que más se va a cometer en esta pantalla.
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
      // E3 arma su enlace desde `{{ .SiteURL }}` y no usa este destino
      // (`lib/email/generar.mts` explica por qué). Se manda igual: el día que
      // la plantilla cambie de criterio, el enlace ya viene con a dónde ir.
      redirectTo: urlDeContrasenaNueva(),
    },
  );

  if (error || !data?.user) {
    // Puede haber una identidad en `auth.users` sin perfil —un alta social a
    // medias (§13.4)—, y entonces la comprobación de arriba no la vio.
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

/**
 * Editar nombre, apellido y teléfono de otra persona — RF-26.
 *
 * El email no se toca (lo explica `schemas.ts`), y el rol tiene su propia
 * operación: cambiar quién entra al panel no es lo mismo que corregir un
 * teléfono mal tipeado, y meterlos en el mismo «Guardar» hace que una decisión
 * viaje escondida adentro de la otra.
 */
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

  // Los emails de GoTrue saludan con `first_name` de `user_metadata`: sin
  // esto, a quien le corrigen el nombre acá lo sigue saludando con el viejo.
  // Va por el cliente de servicio porque la cuenta es de otra persona.
  const { error } = await createServiceClient().auth.admin.updateUserById(
    datos.id,
    {
      user_metadata: {
        full_name: `${datos.firstName} ${datos.lastName}`,
        first_name: datos.firstName,
      },
    },
  );

  // **No se deshace lo guardado ni se falla por esto**: el perfil es lo que
  // la tienda usa, y decirle «no pudimos» a quien sí guardó sería mentirle.
  // Se devuelve para que la acción lo reporte, como hace «Mis datos» (F5.2).
  return { errorDeMetadatos: error?.message ?? null };
}

/**
 * Cambiar el rol — RF-26, con las dos reglas que impiden quedarse afuera.
 *
 * **La primera la pide el requisito**: la administradora no puede quitarse a
 * sí misma el rol. Es la que evita el clic distraído que deja a quien lo hizo
 * sin panel en la pantalla siguiente.
 *
 * **La segunda no está escrita en RF-26 y es la misma trampa por otro camino**:
 * quitarle el rol a la *última* administradora deja la tienda sin nadie que
 * pueda entrar, y recuperarla es un `UPDATE` a mano en la base —está contado
 * en PROGRESO, porque ya pasó—. Se rechaza igual, y con un mensaje que explica
 * qué hacer: primero nombrar a otra.
 */
export async function cambiarRolDeUsuario(datos: {
  id: string;
  rol: RolAsignable;
  actorId: string;
}): Promise<{ cambiado: boolean }> {
  const [usuario] = await db.execute<{ role: string }>(sql`
    SELECT role FROM user_profiles WHERE id = ${datos.id}`);

  if (!usuario) throw domainError("NOT_FOUND");

  // Sin cambio no hay nada que hacer, y decirlo evita una fila de auditoría
  // futura que no cuenta nada.
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
 * Restablecer la contraseña — RF-26: «dispara el email de recuperación».
 *
 * **Manda E2, el mismo email que sale de «¿Olvidaste tu contraseña?»**, y no
 * una contraseña nueva: la vendedora no llega a saber la contraseña de nadie,
 * que es lo que corresponde y además lo que el sistema ya sabía hacer.
 *
 * **Va por un cliente suelto, sin cookies.** Con el cliente del servidor, el
 * desafío PKCE quedaría registrado contra la sesión de quien aprieta el botón
 * —la administradora— y no contra el navegador de la persona que va a abrir el
 * enlace. E2 viaja con `token_hash`, que `/api/auth/confirmar` canjea sin
 * depender de ninguna cookie.
 */
export async function mandarRecuperacion(id: string): Promise<{
  email: string;
}> {
  const [usuario] = await db.execute<{ email: string; isBanned: boolean }>(sql`
    SELECT email, is_banned AS "isBanned" FROM user_profiles WHERE id = ${id}`);

  if (!usuario) throw domainError("NOT_FOUND");

  // A una cuenta bloqueada no se le manda a elegir contraseña: no va a poder
  // entrar igual (RF-27), y el email la invitaría a intentarlo.
  if (usuario.isBanned) {
    throw domainError("VALIDATION", {
      message:
        "Esa cuenta está bloqueada: desbloqueala primero y después mandale " +
        "el email.",
    });
  }

  const cliente = crearClienteSuelto(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await cliente.auth.resetPasswordForEmail(usuario.email, {
    redirectTo: urlDeContrasenaNueva(),
  });

  if (error) throw new Error(`resetPasswordForEmail falló: ${error.message}`);

  return { email: usuario.email };
}
