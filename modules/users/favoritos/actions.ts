"use server";

import { refresh } from "next/cache";

import { action } from "@/lib/action";
import { desmarcar, marcar } from "@/modules/users/favoritos/operaciones";
import { recordar, tomar } from "@/modules/users/favoritos/pendiente";
import {
  cambioDeFavorito,
  eleccionDeVista,
  sinDatos,
  soloProducto,
} from "@/modules/users/favoritos/schemas";
import { guardarVista } from "@/modules/users/favoritos/vista";

/**
 * Guardar y quitar no refrescan, a propósito: en «Favoritos» la tarjeta
 * desaparecería en el acto, y quien la quitó sin querer no podría volver a
 * guardarla.
 */

export const cambiarFavorito = action
  .input(cambioDeFavorito)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const userId = ctx.session.profile.id;
    if (input.marcado) await marcar(userId, input.productId);
    else await desmarcar(userId, input.productId);
    return { marcado: input.marcado };
  });

export const elegirVistaDeFavoritos = action
  .input(eleccionDeVista)
  .auth("customer")
  .aunConBajaPendiente()
  .handler(async ({ input }) => {
    await guardarVista(input.vista);
    refresh();
    return { vista: input.vista };
  });

export const recordarFavoritoPendiente = action
  .input(soloProducto)
  .auth("public")
  .handler(async ({ input }) => {
    await recordar(input.productId);
    return { recordado: true };
  });

/** La entrada no dice qué guardar: sale de la cookie del servidor. */
export const retomarFavoritoPendiente = action
  .input(sinDatos)
  .auth("customer")
  .handler(async ({ ctx }) => {
    const productId = await tomar();
    if (!productId) return { retomado: false as const };

    await marcar(ctx.session.profile.id, productId);
    refresh();
    return { retomado: true as const };
  });
