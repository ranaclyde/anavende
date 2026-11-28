"use server";

import { refresh } from "next/cache";

import { action } from "@/lib/action";
import {
  agregar,
  cambiarCantidad,
  quitar,
  vaciar,
} from "@/modules/cart/operaciones";
import { recordar, tomar } from "@/modules/cart/pendiente";
import {
  lineaDelCarrito,
  sinDatos,
  soloVariante,
} from "@/modules/cart/schemas";

// `refresh()` y no `revalidatePath`: nada del carrito está cacheado (lee la
// sesión), lo que hay que actualizar es la pantalla abierta.

export const agregarAlCarrito = action
  .input(lineaDelCarrito)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const resultado = await agregar(ctx.session.profile.id, input);
    refresh();
    return resultado;
  });

export const cambiarCantidadDelCarrito = action
  .input(lineaDelCarrito)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const resultado = await cambiarCantidad(ctx.session.profile.id, input);
    refresh();
    return resultado;
  });

export const quitarDelCarrito = action
  .input(soloVariante)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const resultado = await quitar(ctx.session.profile.id, input.variantId);
    refresh();
    return resultado;
  });

export const vaciarElCarrito = action
  .input(sinDatos)
  .auth("customer")
  .handler(async ({ ctx }) => {
    const resultado = await vaciar(ctx.session.profile.id);
    refresh();
    return resultado;
  });

/**
 * Es `public` porque quien la llama todavía no tiene sesión. No valida la
 * variante: el rechazo ocurre al retomar, con el stock de ese momento.
 */
export const recordarCompraPendiente = action
  .input(lineaDelCarrito)
  .auth("public")
  .handler(async ({ input }) => {
    await recordar(input);
    return { recordado: true };
  });

/**
 * La entrada no dice qué agregar, a propósito: sale de la cookie que escribió
 * el servidor. Si viniera del cliente, sería un «agregá esto» con otro nombre.
 */
export const retomarCompraPendiente = action
  .input(sinDatos)
  .auth("customer")
  .handler(async ({ ctx }) => {
    const pendiente = await tomar();
    if (!pendiente) return { retomado: false as const };

    // Si esto tira, la cookie ya se borró: el intento no se repite.
    const { cantidad } = await agregar(ctx.session.profile.id, pendiente);
    refresh();

    return { retomado: true as const, cantidad };
  });
