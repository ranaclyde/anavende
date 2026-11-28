"use server";

import { refresh } from "next/cache";

import { action } from "@/lib/action";
import {
  agregarDireccion,
  editarDireccion,
  eliminarDireccion,
  hacerPredeterminada,
} from "@/modules/users/direcciones/operaciones";
import {
  aDatosDeDireccion,
  direccionSchema,
  edicionDeDireccionSchema,
  soloIdSchema,
} from "@/modules/users/direcciones/schemas";

/**
 * El `userId` sale de la sesión y nunca de la entrada (§13.8). Agregar y
 * editar no refrescan: el formulario vuelve a la lista, que se dibuja de nuevo.
 */

export const guardarDireccionNueva = action
  .input(direccionSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) =>
    agregarDireccion(ctx.session.profile.id, aDatosDeDireccion(input)),
  );

export const guardarCambiosDeDireccion = action
  .input(edicionDeDireccionSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const { id, ...resto } = input;
    await editarDireccion(ctx.session.profile.id, id, aDatosDeDireccion(resto));
    return { guardada: true };
  });

export const usarComoPredeterminada = action
  .input(soloIdSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    await hacerPredeterminada(ctx.session.profile.id, input.id);
    refresh();
    return { predeterminada: true };
  });

export const eliminarLaDireccion = action
  .input(soloIdSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    await eliminarDireccion(ctx.session.profile.id, input.id);
    refresh();
    return { eliminada: true };
  });
