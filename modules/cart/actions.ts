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

/**
 * «Iniciá sesión para comprar»: anotar qué se estaba comprando — F5.7, RF-08.
 *
 * Es `public` porque el que la llama todavía no tiene sesión: es la única
 * acción del carrito que no la exige, y no toca la base. Lo único que hace es
 * dejar la nota (`modules/cart/pendiente.ts`); después el botón lleva a
 * `/ingresar`.
 *
 * **No valida que la variante exista.** Podría, pero sería un viaje a la base
 * para adelantar un rechazo que igual va a ocurrir donde tiene que ocurrir:
 * al retomar, con el stock del momento —que es otro, un rato después— y con
 * el mensaje que el comprador necesita leer.
 */
export const recordarCompraPendiente = action
  .input(lineaDelCarrito)
  .auth("public")
  .handler(async ({ input }) => {
    await recordar(input);
    return { recordado: true };
  });

/**
 * Retomar lo que quedó pendiente, ya con sesión — F5.7, RF-08.
 *
 * **La entrada no dice qué agregar, y no es un olvido**: sale de la cookie,
 * que la escribió el servidor. Si viniera del cliente, esta acción sería un
 * «agregá esto al carrito» con otro nombre, y quien la llame elige el
 * producto y la cantidad. Lo único que el cliente decide acá es *cuándo*
 * preguntar.
 *
 * Sin nada pendiente devuelve `retomado: false` en vez de un error: que no
 * haya nada que retomar es lo normal, no una falla.
 */
export const retomarCompraPendiente = action
  .input(sinDatos)
  .auth("customer")
  .handler(async ({ ctx }) => {
    const pendiente = await tomar();
    if (!pendiente) return { retomado: false as const };

    // Si esto tira, la cookie ya se borró: el intento no se repite solo, y el
    // envoltorio devuelve el motivo —«Quedan 2 unidades…»— para mostrarlo.
    const { cantidad } = await agregar(ctx.session.profile.id, pendiente);
    refresh();

    return { retomado: true as const, cantidad };
  });
