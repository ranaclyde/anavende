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
 * Las acciones de favoritos — RF-10 · TS §6.2. Tarea F5.4.
 *
 * **Guardar y quitar NO refrescan la pantalla**, a diferencia del carrito. El
 * corazón ya muestra el estado nuevo al tocarlo, y no hay ningún número en el
 * encabezado que actualizar. Refrescar volvería a pedir el catálogo entero por
 * un ícono, y en «Favoritos» haría desaparecer la tarjeta en el acto: quien la
 * quitó sin querer se quedaría sin forma de volver a guardarla.
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

/**
 * Lista o tarjetas en «Favoritos». Refresca porque la página se dibuja en el
 * servidor con la vista que dice la cookie.
 */
export const elegirVistaDeFavoritos = action
  .input(eleccionDeVista)
  .auth("customer")
  // Cómo se ve una lista no es operar la cuenta: con la baja pedida (F5.8)
  // se sigue pudiendo mirar, y esto es mirar.
  .aunConBajaPendiente()
  .handler(async ({ input }) => {
    await guardarVista(input.vista);
    refresh();
    return { vista: input.vista };
  });

/**
 * El corazón de un visitante: anotar qué quería guardar y mandarlo a
 * ingresar. `public` porque todavía no hay sesión; no toca la base.
 */
export const recordarFavoritoPendiente = action
  .input(soloProducto)
  .auth("public")
  .handler(async ({ input }) => {
    await recordar(input.productId);
    return { recordado: true };
  });

/**
 * Retomarlo, ya con sesión. Como en el carrito, la entrada no dice qué
 * guardar: sale de la cookie que escribió el servidor.
 *
 * **Esta sí refresca**: la pantalla se dibujó antes de guardarlo, y el
 * corazón tiene que aparecer marcado.
 */
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
