"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { action } from "@/lib/action";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { crearOrdenManual } from "@/modules/orders/manual";
import {
  buscarCompradoresParaLaOrden,
  buscarVariantesParaLaOrden,
} from "@/modules/orders/queries-manual";
import {
  ordenManualSchema,
  type OrdenManualValidada,
} from "@/modules/orders/schemas-manual";
import { ubicacionGuardada } from "@/modules/users/direcciones/schemas";

const loQueSeEscribio = z.object({
  q: z.string().trim().max(80),
});

export const buscarVariantes = action
  .input(loQueSeEscribio)
  .auth("admin")
  .handler(async ({ input }) => ({
    resultados: await buscarVariantesParaLaOrden(input.q),
  }));

export const buscarCompradores = action
  .input(loQueSeEscribio)
  .auth("admin")
  .handler(async ({ input }) => ({
    resultados: await buscarCompradoresParaLaOrden(input.q),
  }));

/** Con retiro devuelve `null`, que es lo que marca la orden como retiro (`entrega.ts`). */
function direccionDeLaOrden(
  input: OrdenManualValidada,
): ShippingAddressSnapshot | null {
  if (input.entrega !== "envio" || !input.direccion) return null;

  // Vacío es `null`, no la cadena vacía.
  const d = input.direccion;
  return {
    recipientName: d.recipientName,
    phone: d.phone,
    street: d.street,
    number: d.number,
    apartment: d.apartment || null,
    notes: d.notes || null,
    ...ubicacionGuardada({
      localidad: d.localidad,
      otraLocalidad: d.otraLocalidad ?? null,
      provinciaDeOtra: d.provinciaDeOtra,
    }),
  };
}

/** Sin clave de idempotencia: el doble clic lo evita la pantalla deshabilitando el botón. */
export const crearLaOrdenManualDelPanel = action
  .input(ordenManualSchema)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orden = await crearOrdenManual({
      creadaPor: ctx.session.profile.id,
      userId: input.cuentaId ?? null,
      estado: input.estado,
      fechaDeVenta: input.fechaDeVenta ?? null,
      customerName: input.nombre,
      customerEmail: input.email || null,
      customerPhone: input.telefono,
      direccion: direccionDeLaOrden(input),
      notas: input.notas || null,
      items: input.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.cantidad,
        unitPrice: i.precio,
      })),
    });

    refresh();
    return { numero: orden.orderNumber };
  });
