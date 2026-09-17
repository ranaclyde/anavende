"use server";

import * as Sentry from "@sentry/nextjs";
import { refresh } from "next/cache";

import { action } from "@/lib/action";
import {
  bloquearUsuario,
  cambiarRolDeUsuario,
  desbloquearUsuario,
  editarUsuario,
  ejecutarBaja,
  invitarUsuario,
  mandarRecuperacion,
  revertirBaja,
} from "@/modules/users/panel/operaciones";
import {
  altaDeUsuario,
  bajaDeUsuario,
  bloqueoDeUsuario,
  cambioDeRol,
  desbloqueoDeUsuario,
  edicionDeUsuario,
  restablecerContrasena,
} from "@/modules/users/panel/schemas";

/**
 * Acciones del panel sobre usuarios — FS RF-26, RF-27, RF-34 · TS §13.2.
 * Tareas F7.6, F7.7 y F7.9.
 *
 * **Todas `.auth("admin")`**, sin excepción: son las cosas que se le pueden
 * hacer a la cuenta de otra persona, y ninguna la puede hacer quien no entra
 * al panel.
 *
 * **El `id` viaja en la entrada, al revés de las acciones del comprador.** Allá
 * el `WHERE` sale de la sesión y nunca del cliente, porque sin RLS es la única
 * barrera entre una cuenta y otra (§13.8). Acá la administradora opera sobre
 * cuentas ajenas por definición: la barrera es el rol, verificado contra la
 * base en cada acción (§13.3).
 */

/**
 * Dar de alta a alguien — RF-26.
 *
 * Devuelve el `id` para que la pantalla lleve a su ficha: el alta casi siempre
 * sigue con «y ahora quiero ver cómo quedó».
 */
export const darDeAltaUsuario = action
  .input(altaDeUsuario)
  .auth("admin")
  .handler(async ({ input }) => {
    const { id } = await invitarUsuario(input);
    refresh();
    return { id, email: input.email };
  });

/**
 * Corregir nombre, apellido y teléfono — RF-26.
 *
 * **Devuelve los datos como quedaron guardados**, y no un `{ guardado: true }`:
 * el esquema normaliza el teléfono —«11 4444 3333» se guarda `+5491144443333`—
 * y sin devolverlo, el formulario se queda mostrando lo tipeado y creyendo que
 * todavía hay cambios sin guardar. Lo encontró el repaso.
 */
export const guardarDatosDelUsuario = action
  .input(edicionDeUsuario)
  .auth("admin")
  .handler(async ({ input }) => {
    const { errorDeMetadatos } = await editarUsuario(input);

    if (errorDeMetadatos) {
      // El perfil quedó guardado y los emails van a saludar con el nombre
      // viejo. Es un incidente para mirar, no un fallo para la pantalla.
      Sentry.captureException(new Error(errorDeMetadatos), {
        tags: { capa: "server-action", paso: "user_metadata" },
      });
    }

    refresh();
    return {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    };
  });

/**
 * Cambiar el rol — RF-26.
 *
 * **Quién lo pide sale de la sesión y no de la entrada**: la regla de «no
 * podés cambiarte el rol a vos misma» se apoya en eso, y leerlo del cliente
 * sería dejar que quien quiere saltársela mande otro `id`.
 */
export const cambiarRol = action
  .input(cambioDeRol)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const resultado = await cambiarRolDeUsuario({
      id: input.id,
      rol: input.rol,
      actorId: ctx.session.profile.id,
    });

    refresh();
    return resultado;
  });

/**
 * Mandarle el email para elegir una contraseña nueva — RF-26.
 *
 * Devuelve el email para que la pantalla diga a dónde salió: «le mandamos el
 * email» sin decir a cuál dirección es justo lo que no se puede verificar de
 * un vistazo.
 */
export const mandarRestablecerContrasena = action
  .input(restablecerContrasena)
  .auth("admin")
  .handler(async ({ input }) => {
    const { email } = await mandarRecuperacion(input.id);
    return { email };
  });

/**
 * Bloquear una cuenta — RF-27. Tarea F7.7.
 *
 * **Quién bloquea sale de la sesión**, como en el cambio de rol: es lo que
 * queda registrado en `banned_by` y en el historial, y leerlo del cliente
 * sería dejar que quien bloquea firme con el nombre de otra.
 *
 * **Si Supabase Auth no contesta, no se falla**: la cuenta ya quedó bloqueada
 * donde importa —el envoltorio la frena en toda acción— y decir «no pudimos»
 * sería mentir. Va a Sentry, y vuelve para que el diálogo lo aclare.
 */
export const bloquearCuenta = action
  .input(bloqueoDeUsuario)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const resultado = await bloquearUsuario({
      id: input.id,
      motivo: input.motivo,
      actorId: ctx.session.profile.id,
    });

    avisarDeAuth(resultado.errorDeAuth, "bloquear");
    refresh();
    return resultado;
  });

/** Desbloquear — RF-27. Queda registrado igual que el bloqueo. */
export const desbloquearCuenta = action
  .input(desbloqueoDeUsuario)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const resultado = await desbloquearUsuario({
      id: input.id,
      actorId: ctx.session.profile.id,
    });

    avisarDeAuth(resultado.errorDeAuth, "desbloquear");
    refresh();
    return resultado;
  });

/**
 * Ejecutar la baja que pidió el comprador — RF-34. Tarea F7.9.
 *
 * **Quién la ejecuta sale de la sesión**, como el bloqueo: es lo que queda en
 * `closed_by` y en el historial, y es la mitad de lo que RF-34 pide registrar.
 */
export const ejecutarBajaDeCuenta = action
  .input(bajaDeUsuario)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const resultado = await ejecutarBaja({
      id: input.id,
      actorId: ctx.session.profile.id,
    });

    avisarDeAuth(resultado.errorDeAuth, "baja");
    refresh();
    return resultado;
  });

/** Revertirla — RF-34: la persona vuelve, y con todo lo suyo donde estaba. */
export const revertirBajaDeCuenta = action
  .input(bajaDeUsuario)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const resultado = await revertirBaja({
      id: input.id,
      actorId: ctx.session.profile.id,
    });

    avisarDeAuth(resultado.errorDeAuth, "revertir_baja");
    refresh();
    return resultado;
  });

/**
 * La base quedó bien y Supabase Auth no: es un incidente para mirar, no un
 * fallo para la pantalla. Mismo criterio que los metadatos de la edición.
 */
function avisarDeAuth(error: string | null, paso: string) {
  if (!error) return;
  Sentry.captureException(new Error(error), {
    tags: { capa: "server-action", paso: `auth_${paso}` },
  });
}
