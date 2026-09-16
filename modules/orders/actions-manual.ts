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

/**
 * Acciones del alta manual — FS RF-24 · TS §8.1. Tarea F7.4.
 *
 * Las tres llevan `.auth("admin")`: cargar una venta, buscar en el catálogo y
 * buscar compradores son trabajo del panel. **Las dos búsquedas son acciones
 * y no rutas de API** porque la pantalla ya es un formulario de cliente y el
 * envoltorio les pone la misma guardia que al alta — una ruta paralela sería
 * otra puerta que asegurar por separado (§6.2).
 */

const loQueSeEscribio = z.object({
  q: z.string().trim().max(80),
});

/** El buscador de productos, que F7.2a va a volver a usar. */
export const buscarVariantes = action
  .input(loQueSeEscribio)
  .auth("admin")
  .handler(async ({ input }) => ({
    resultados: await buscarVariantesParaLaOrden(input.q),
  }));

/** El buscador de compradores registrados, para asociar la orden. */
export const buscarCompradores = action
  .input(loQueSeEscribio)
  .auth("admin")
  .handler(async ({ input }) => ({
    resultados: await buscarCompradoresParaLaOrden(input.q),
  }));

/**
 * De los campos del formulario al snapshot que guarda la orden.
 *
 * **Con retiro devuelve `null`, y ese `null` es el dato** (§5.6): la orden no
 * tiene columna de forma de entrega, así que una sin dirección es un retiro.
 * La ubicación se deduce con la misma función que usa la libreta del
 * comprador, para que las dos escriban el mismo código postal.
 */
function direccionDeLaOrden(
  input: OrdenManualValidada,
): ShippingAddressSnapshot | null {
  if (input.entrega !== "envio" || !input.direccion) return null;

  // Vacío es `null` y no la cadena vacía: el snapshot se lee después en dos
  // pantallas, y un «, » colgado de un piso que no existe se nota.
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

/**
 * Cargar la venta — RF-24.
 *
 * **Sin clave de idempotencia**, a diferencia del checkout (§8.5): la
 * especificación deja `idempotency_key` en NULL para las manuales, que las
 * carga una persona de a una. Lo que evita el doble clic es la pantalla, que
 * deshabilita el botón mientras la acción viaja.
 */
export const crearLaOrdenManualDelPanel = action
  .input(ordenManualSchema)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const orden = await crearOrdenManual({
      creadaPor: ctx.session.profile.id,
      userId: input.cuentaId ?? null,
      estado: input.estado,
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

    // El listado de órdenes y el stock del catálogo quedaron viejos.
    refresh();
    return { numero: orden.orderNumber };
  });
