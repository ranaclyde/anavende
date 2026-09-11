"use server";

import { refresh } from "next/cache";

import { action } from "@/lib/action";
import {
  agregar,
  cambiarCantidad,
  quitar,
  vaciar,
} from "@/modules/cart/operaciones";
import {
  lineaDelCarrito,
  sinDatos,
  soloVariante,
} from "@/modules/cart/schemas";

/**
 * Las acciones del carrito — RF-08 · TS §6.2. Tarea F5.5.
 *
 * Son `customer`: sin sesión no existe carrito (RF-08), y el envoltorio
 * rechaza antes de llegar acá. El `userId` sale de la sesión y nunca de la
 * entrada (§13.8).
 *
 * **`refresh()` y no `revalidatePath`.** Nada de lo que muestra el carrito
 * está cacheado: el carrito, la ficha y el encabezado leen la sesión, así que
 * son dinámicos siempre (§12). Lo que hay que actualizar es la pantalla que
 * ya está abierta —el número del encabezado después de agregar desde la
 * ficha, el total después de cambiar una cantidad—, y `refresh()` hace eso y
 * nada más.
 */

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
