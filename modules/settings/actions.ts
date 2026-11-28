"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { paymentMethods, paymentPromotions } from "@/db/schema/settings";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import {
  borrarArchivos,
  clavesDelLogo,
  quitarLogo,
} from "@/modules/media/subir";
import { olvidarElInterruptor } from "@/modules/settings/mantenimiento";
import {
  escribirElModoMantenimiento,
  escribirLaConfiguracion,
} from "@/modules/settings/service";
import {
  cambioDeEstadoDePago,
  cambioDeEstadoDePromocion,
  configuracionDelSitio,
  crearPromocion,
  editarPromocion,
  soloPromocion,
  crearMedioDePago,
  editarMedioDePago,
  modoMantenimiento,
  movimientoDePago,
  soloMedioDePago,
} from "@/modules/settings/schemas";

// Sin conteo de uso a propósito: nada apunta a `payment_methods`, así que RN-11
// no les cabe (TECHNICAL-SPEC §5.9).

function refrescar() {
  revalidatePath("/admin/catalogo", "layout");
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Deja las posiciones en 0, 1, 2… El orden tiene que ser el mismo que el del
 * listado y el de mover: si no, la pantalla muestra uno y el botón mueve otro.
 */
async function renumerar(tx: Tx): Promise<void> {
  await tx.execute(sql`
    WITH ordenados AS (
      SELECT id,
             row_number() OVER (
               ORDER BY sort_order, immutable_unaccent(lower(name))
             ) - 1 AS n
        FROM payment_methods
    )
    UPDATE payment_methods p
       SET sort_order = o.n
      FROM ordenados o
     WHERE p.id = o.id AND p.sort_order <> o.n`);
}

export const crearUnMedioDePago = action
  .input(crearMedioDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    const [fila] = await db.execute<{ id: string }>(sql`
      INSERT INTO payment_methods (name, description, sort_order)
      -- Al final de la lista. Elegir la posición es una acción aparte, igual
      -- que reordenar las imágenes de una variante (RF-17).
      VALUES (${input.name}, ${input.description},
              (SELECT coalesce(max(sort_order), -1) + 1 FROM payment_methods))
      RETURNING id`);

    refrescar();
    return { id: fila.id };
  });

export const editarUnMedioDePago = action
  .input(editarMedioDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .update(paymentMethods)
      .set({ name: input.name, description: input.description })
      .where(eq(paymentMethods.id, input.id))
      .returning({ id: paymentMethods.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id };
  });

export const cambiarEstadoDeMedioDePago = action
  .input(cambioDeEstadoDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .update(paymentMethods)
      .set({ isActive: input.activo })
      .where(eq(paymentMethods.id, input.id))
      .returning({ id: paymentMethods.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id, activo: input.activo };
  });

/**
 * Reescribe todas las posiciones y no solo las dos que cambian: intercambiar
 * dos números repetidos no movería nada.
 *
 * Llegar al borde (dos pestañas abiertas) no es un error: la lista queda igual.
 */
export const moverMedioDePago = action
  .input(movimientoDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    await db.transaction(async (tx) => {
      const filas = await tx.execute<{ id: string }>(sql`
        SELECT id FROM payment_methods
         ORDER BY sort_order, immutable_unaccent(lower(name))
           FOR UPDATE`);

      const ids = filas.map((f) => f.id);
      const desde = ids.indexOf(input.id);
      if (desde === -1) throw domainError("NOT_FOUND");

      const hasta = input.direccion === "arriba" ? desde - 1 : desde + 1;
      if (hasta < 0 || hasta >= ids.length) return;

      [ids[desde], ids[hasta]] = [ids[hasta], ids[desde]];

      const orden = sql.join(
        ids.map((id, n) => sql`(${id}::uuid, ${n}::int)`),
        sql`, `,
      );

      await tx.execute(sql`
        UPDATE payment_methods p
           SET sort_order = o.n
          FROM (VALUES ${orden}) AS o(id, n)
         WHERE p.id = o.id AND p.sort_order <> o.n`);
    });

    refrescar();
    return { id: input.id };
  });

/** Subirlo va por `POST /api/admin/upload`: una acción lo pasaría a base64. */
export const quitarElLogoDelMedioDePago = action
  .input(soloMedioDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    await quitarLogo("medio-de-pago", input.id);
    refrescar();
    return { id: input.id };
  });

export const eliminarUnMedioDePago = action
  .input(soloMedioDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    // Antes del DELETE: después la fila ya no está y las claves se pierden.
    const archivos = await clavesDelLogo("medio-de-pago", input.id);

    await db.transaction(async (tx) => {
      const filas = await tx
        .delete(paymentMethods)
        .where(eq(paymentMethods.id, input.id))
        .returning({ id: paymentMethods.id });

      if (!filas.length) throw domainError("NOT_FOUND");

      await renumerar(tx);
    });

    // No puede fallar hacia afuera: la fila ya se borró, y un archivo que
    // sobreviva es basura, no un error para la vendedora.
    if (archivos.length) await borrarArchivos(archivos);

    refrescar();
    return { id: input.id };
  });

/** La tienda no se revalida: la ficha se arma en cada pedido. */
export const crearUnaPromocion = action
  .input(crearPromocion)
  .auth("admin")
  .handler(async ({ input }) => {
    // INSERT … SELECT: si el medio se borró en otra pestaña, da «no
    // encontrado» y no un error de clave foránea.
    const [fila] = await db.execute<{ id: string }>(sql`
      INSERT INTO payment_promotions
             (payment_method_id, plan_name, installments, surcharge_pct,
              starts_on, ends_on, min_amount)
      SELECT id, ${input.plan}, ${input.cuotas}, ${input.recargo},
             ${input.desde}, ${input.hasta}, ${input.montoMinimo}
        FROM payment_methods
       WHERE id = ${input.paymentMethodId}
      RETURNING id`);

    if (!fila) throw domainError("NOT_FOUND");

    refrescar();
    return { id: fila.id };
  });

export const editarUnaPromocion = action
  .input(editarPromocion)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .update(paymentPromotions)
      .set({
        planName: input.plan,
        installments: input.cuotas,
        surchargePct: input.recargo,
        startsOn: input.desde,
        endsOn: input.hasta,
        minAmount: input.montoMinimo,
      })
      .where(eq(paymentPromotions.id, input.id))
      .returning({ id: paymentPromotions.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id };
  });

export const cambiarEstadoDePromocion = action
  .input(cambioDeEstadoDePromocion)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .update(paymentPromotions)
      .set({ isActive: input.activa })
      .where(eq(paymentPromotions.id, input.id))
      .returning({ id: paymentPromotions.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id, activa: input.activa };
  });

export const eliminarUnaPromocion = action
  .input(soloPromocion)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .delete(paymentPromotions)
      .where(eq(paymentPromotions.id, input.id))
      .returning({ id: paymentPromotions.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id };
  });

export const guardarLaConfiguracion = action
  .input(configuracionDelSitio)
  .auth("admin")
  .handler(async ({ input }) => {
    const guardada = await escribirLaConfiguracion(input);

    // Todo, a propósito: la leen muchas pantallas, y una lista de rutas acá
    // quedaría vieja el día que se sume una.
    revalidatePath("/", "layout");

    // Lo guardado y no lo enviado: el formulario muestra el número normalizado.
    return guardada;
  });

/** En el proxy tarda hasta `VIGENCIA_MS` en notarse. */
export const cambiarElModoMantenimiento = action
  .input(modoMantenimiento)
  .auth("admin")
  .handler(async ({ input }) => {
    const activo = await escribirElModoMantenimiento(input.activo);

    if (activo === null) {
      throw domainError("VALIDATION", {
        message:
          "Guardá primero la configuración de arriba: hasta que exista, no hay dónde anotar que la tienda está cerrada.",
      });
    }

    olvidarElInterruptor();
    // El aviso de «solo vos la ves así» está en el layout de la tienda.
    revalidatePath("/", "layout");
    return { activo };
  });
