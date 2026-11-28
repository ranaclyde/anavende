"use server";

import { refresh } from "next/cache";

import { action } from "@/lib/action";
import { pedirBaja, retirarBaja } from "@/modules/users/baja/operaciones";
import { pedidoDeBaja, sinDatos } from "@/modules/users/baja/schemas";

// Pedir no refresca: el formulario navega a «Mis datos» y refresca desde ahí.

export const pedirLaBaja = action
  .input(pedidoDeBaja)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    return pedirBaja(ctx.session.profile.id, input.motivo);
  });

export const retirarElPedidoDeBaja = action
  .input(sinDatos)
  .auth("customer")
  .evenWithPendingClosure()
  .handler(async ({ ctx }) => {
    const resultado = await retirarBaja(ctx.session.profile.id);
    refresh();
    return resultado;
  });
