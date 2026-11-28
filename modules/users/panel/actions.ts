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
 * Todas `.auth("admin")`. El `id` viaja en la entrada, al revés de las
 * acciones del comprador: acá la barrera es el rol (§13.3, §13.8). Quien actúa
 * (`actorId`) sale siempre de la sesión, nunca de la entrada.
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
 * Devuelve los datos normalizados (el teléfono cambia de forma): si no, el
 * formulario cree que todavía hay cambios sin guardar.
 */
export const guardarDatosDelUsuario = action
  .input(edicionDeUsuario)
  .auth("admin")
  .handler(async ({ input }) => {
    const { errorDeMetadatos } = await editarUsuario(input);

    if (errorDeMetadatos) {
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

export const mandarRestablecerContrasena = action
  .input(restablecerContrasena)
  .auth("admin")
  .handler(async ({ input }) => {
    const { email } = await mandarRecuperacion(input.id);
    return { email };
  });

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

/** La base quedó bien y GoTrue no: se reporta, la pantalla no falla. */
function avisarDeAuth(error: string | null, paso: string) {
  if (!error) return;
  Sentry.captureException(new Error(error), {
    tags: { capa: "server-action", paso: `auth_${paso}` },
  });
}
