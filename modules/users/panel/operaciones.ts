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
 *
 * **La baja se EJECUTA acá y se PIDE en `modules/users/baja`**, que es el lado
 * del comprador. Están separadas porque son dos permisos distintos sobre la
 * misma columna, y vive de este lado lo que pasa por `.auth("admin")`.
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

  // A una cuenta bloqueada no se le manda a elegir contraseña: no va a poder
  // entrar igual (RF-27), y el email la invitaría a intentarlo. Con la baja
  // ejecutada pasa lo mismo, y es peor: a alguien que se fue por su cuenta, un
  // email para elegir contraseña le llega como si nada hubiera pasado.
  if (usuario.isBanned || usuario.dadoDeBaja) {
    throw domainError("VALIDATION", {
      message: usuario.dadoDeBaja
        ? "Esa cuenta está dada de baja: revertí la baja primero y después " +
          "mandale el email."
        : "Esa cuenta está bloqueada: desbloqueala primero y después mandale " +
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

/**
 * Bloquear una cuenta — FS RF-27 · TS §13.5. Tarea F7.7.
 *
 * **Primero la base y después Supabase Auth, y el orden es la decisión.** Si
 * GoTrue falla, la cuenta queda marcada y el envoltorio de acciones (§6.2) ya
 * la frena, aunque todavía pueda iniciar sesión. Al revés —GoTrue primero— un
 * fallo de la base dejaría a alguien afuera **sin motivo registrado**, que es
 * exactamente lo que RF-27 no admite.
 *
 * **La sesión que ya estaba abierta la cierra `proxy.ts`**, en el próximo
 * pedido a una ruta privada: un JWT emitido no se puede revocar y el
 * `admin.signOut` del SDK pide el token de esa persona, que no tenemos
 * (`modules/users/acceso.ts` lo cuenta entero).
 *
 * **El motivo no es una nota interna: es lo que la persona lee al intentar
 * entrar** (`components/shop/login-form.tsx`, desde F1.7). La restricción
 * `ban_has_reason` impide guardarlo vacío, y el `UPDATE` y la fila del
 * historial viajan en la misma transacción, como pide P5.
 *
 * **Bloquear lo ya bloqueado no hace nada**, igual que cambiar un rol al que
 * ya está: es el doble clic y las dos pestañas, y una segunda fila de
 * historial contaría un bloqueo que no ocurrió.
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
    // Se bloquea la fila mientras se decide: sin esto, dos pedidos a la vez
    // escriben dos filas de historial para un solo bloqueo.
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

    // **Una cuenta dada de baja no se bloquea** (F7.9). Ya no puede entrar, y
    // las dos marcas juntas dejan a la pantalla de ingreso decidiendo cuál de
    // los dos mensajes da: el de RN-13 —«te fuiste»— o el del bloqueo. Que no
    // se puedan cruzar es más barato que elegir bien cada vez.
    if (usuario.dadoDeBaja) {
      throw domainError("VALIDATION", {
        message:
          "Esa cuenta está dada de baja: ya no puede entrar, así que no hace " +
          "falta bloquearla.",
      });
    }

    // La misma regla que el rol (F7.6) por el mismo motivo: bloquear a la
    // última administradora deja la tienda sin nadie que entre al panel, y
    // salir de ahí es un UPDATE a mano en la base.
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

/**
 * Desbloquear — RF-27: «se puede desbloquear, quedando también registrado».
 *
 * **El registro es la fila del historial y no las columnas**: acá se limpian
 * las cuatro, porque `ban_has_reason` no admite un motivo sin bloqueo. Sin la
 * tabla, desbloquear borraría toda huella de que el bloqueo existió (§5.3).
 *
 * **No pide motivo.** RF-27 lo exige para bloquear —es lo que la persona lee
 * al intentar entrar— y no para lo contrario: a quien vuelve a entrar no hay
 * nada que explicarle.
 */
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
 * Ejecutar una baja pedida — FS RF-34, RN-13 · TS §13.5b. Tarea F7.9.
 *
 * **Solo se ejecuta lo que el comprador pidió** (decisión tuya del
 * 2026-09-17), y lo sostiene el `CHECK` `closed_was_requested`: acá no hay
 * forma de dar de baja a alguien que no lo pidió. Para sacar a alguien por
 * decisión de la vendedora está el bloqueo (RF-27), que además exige un motivo
 * y se lo muestra. Si se pudieran las dos cosas desde el mismo lugar,
 * «se fue sola» dejaría de querer decir eso.
 *
 * **El motivo no se pide ni se pisa**: el que queda es el que escribió la
 * persona al pedirla, y es el que va a la fila del historial. La
 * administradora ejecuta, no redacta.
 *
 * **El mismo orden que el bloqueo, y por el mismo motivo**: primero la base
 * —donde queda registrado quién y cuándo, que es lo que RF-34 pide— y después
 * Supabase Auth. Al revés, un fallo de la base dejaría a alguien afuera sin
 * registro de nada.
 *
 * Ejecutar lo ya ejecutado no hace nada, igual que bloquear lo bloqueado.
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
    }>(sql`
      SELECT closure_requested_at IS NOT NULL AS pedida,
             closed_at            IS NOT NULL AS "yaEsta",
             closure_reason                   AS motivo
        FROM user_profiles
       WHERE id = ${datos.id}
         FOR NO KEY UPDATE`);

    if (!usuario) throw domainError("NOT_FOUND");
    if (usuario.yaEsta) return false;

    // Pudo retirarlo mientras la administradora miraba la ficha: es una
    // pantalla que se deja abierta, y el pedido lo retira la persona cuando
    // quiere. Se dice qué pasó, no «no se pudo».
    if (!usuario.pedida) {
      throw domainError("INVALID_ORDER_STATE", {
        message:
          "Esa cuenta ya no tiene la baja pedida: la persona retiró el " +
          "pedido. Actualizá la página.",
      });
    }

    await tx.execute(sql`
      UPDATE user_profiles
         SET closed_at  = now(),
             closed_by  = ${datos.actorId},
             updated_at = now()
       WHERE id = ${datos.id}`);

    await tx.execute(sql`
      INSERT INTO user_status_history (user_id, event, reason, actor_user_id)
      VALUES (${datos.id}, 'baja', ${usuario.motivo}, ${datos.actorId})`);

    return true;
  });

  if (!hecha) return { ejecutada: false, errorDeAuth: null };

  return {
    ejecutada: true,
    errorDeAuth: await sincronizarAuth(datos.id),
  };
}

/**
 * Revertir una baja ejecutada — RF-34: «la persona vuelve con su historial,
 * sus direcciones y sus favoritos intactos». Tarea F7.9.
 *
 * **Vuelve entera, no a medias**: se limpian la ejecución y también el pedido
 * con su motivo, así que la cuenta queda como cualquier otra. Dejarle el
 * pedido puesto la devolvería a solo lectura, que es un estado que nadie
 * eligió: quien pidió la baja fue la persona, y si vuelve es porque lo
 * arreglaron.
 *
 * **Nada que restaurar**: la baja nunca borró nada (§5.6). Es una marca, y
 * sacarla alcanza.
 *
 * El motivo que se limpia no se pierde: quedó en la fila `baja` del historial.
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

/**
 * Cien años, que es lo que §13.5 eligió para decir «para siempre»: GoTrue
 * guarda una fecha (`banned_until`) y no un booleano, así que un cierre sin
 * fin se escribe como uno muy largo.
 */
const SIN_VENCIMIENTO = "876000h";

/**
 * Dejar a Supabase Auth de acuerdo con el perfil, y lo que pasa si no contesta.
 *
 * **No recibe qué escribir: lo deduce.** `ban_duration` es lo único que GoTrue
 * entiende y **el bloqueo y la baja comparten esa misma llave** (§13.5b), así
 * que quien levante una tiene que mirar la otra antes: desbloquear a alguien
 * que además está dado de baja, escribiendo `none` a ciegas, le devolvería el
 * ingreso a una cuenta que no puede entrar. Con las dos marcas leídas del
 * perfil ese cruce no se puede escribir mal.
 *
 * **No se reintenta ni se deshace lo guardado.** Con la marca en el perfil, la
 * cuenta ya no puede operar —toda Server Action relee el perfil (§13.3)—, así
 * que el peor caso es alguien bloqueado que todavía puede iniciar sesión y no
 * hacer nada. Se devuelve el error para que la pantalla lo diga y Sentry lo
 * anote: «quedó bloqueada» a secas sería mentira.
 *
 * **Lo que sí hace acá el bloqueo de GoTrue**: el token de refresco deja de
 * canjearse (`user_banned`), así que la sesión no se renueva. Lo que no hace
 * es invalidar el token de acceso que ya está emitido —se verifica localmente
 * (§13.3)—, y de eso se encarga el proxy. Medido el 2026-09-16.
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
