"use server";

import { refresh } from "next/cache";

import { action } from "@/lib/action";
import { pedirBaja, retirarBaja } from "@/modules/users/baja/operaciones";
import { pedidoDeBaja, sinDatos } from "@/modules/users/baja/schemas";

/**
 * Las acciones de la baja — RF-34 · TS §6.2. Tarea F5.8.
 *
 * **Pedir no refresca**: quien la pide está en `/mi-cuenta/baja`, que con la
 * baja pedida ya no tiene nada que mostrar. El formulario navega a «Mis
 * datos» y refresca desde ahí, que es donde se ve el pedido y el aviso.
 */

export const pedirLaBaja = action
  .input(pedidoDeBaja)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    return pedirBaja(ctx.session.profile.id, input.motivo);
  });

/**
 * La única acción de comprador que sigue andando con la baja pedida (además
 * de elegir cómo se ve «Favoritos»). Refresca porque el aviso de toda la
 * tienda y los controles apagados tienen que volver en el acto.
 */
export const retirarElPedidoDeBaja = action
  .input(sinDatos)
  .auth("customer")
  .aunConBajaPendiente()
  .handler(async ({ ctx }) => {
    const resultado = await retirarBaja(ctx.session.profile.id);
    refresh();
    return resultado;
  });
