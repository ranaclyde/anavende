import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { domainError, isDomainError } from "@/lib/errors";
import { compare, type Money } from "@/lib/money";
import { reservar } from "@/modules/stock/operaciones";

/**
 * Creación de orden desde el carrito: el procedimiento de TECHNICAL-SPEC §8.4.
 *
 * Abre su propia transacción, al revés que el resto del módulo: si pierde la
 * carrera del índice único de idempotencia, la transacción queda abortada y la
 * relectura de la orden ganadora tiene que hacerse afuera (§8.5).
 */

/** Lo que el comprador vio en el resumen (§8.4 paso 3). */
export type ItemEsperado = {
  variantId: string;
  /** El precio final, ya con descuento. */
  unitPrice: Money;
  quantity: number;
};

export type Entrega = { tipo: "envio"; addressId: string } | { tipo: "retiro" };

export type DatosDeCompra = {
  userId: string;
  idempotencyKey: string;
  entrega: Entrega;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  esperado: readonly ItemEsperado[];
};

export type OrdenCreada = {
  orderId: string;
  orderNumber: number;
  /** `true` si fue un reintento con la misma clave. */
  yaExistia: boolean;
};

type FilaDelCarrito = {
  variantId: string;
  quantity: number;
  productName: string;
  brandName: string;
  colorName: string | null;
  finalPrice: Money;
  productoActivo: boolean;
  varianteActiva: boolean;
};

/** El 23505 de Postgres puede venir envuelto en `cause` por Drizzle. */
function esDuplicado(e: unknown): boolean {
  let actual: unknown = e;
  for (let i = 0; i < 5 && actual; i++) {
    if (
      typeof actual === "object" &&
      "code" in actual &&
      (actual as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    actual = (actual as { cause?: unknown }).cause;
  }
  return false;
}

/** Filtra por `user_id`: con la clave de otro no se puede ver una orden ajena. */
async function buscarPorClave(
  clave: string,
  userId: string,
): Promise<OrdenCreada | null> {
  const [fila] = await db.execute<{ id: string; orderNumber: number }>(sql`
    SELECT id, order_number AS "orderNumber"
      FROM orders WHERE idempotency_key = ${clave} AND user_id = ${userId}`);

  return fila
    ? { orderId: fila.id, orderNumber: fila.orderNumber, yaExistia: true }
    : null;
}

export async function crearOrdenDesdeCarrito(
  datos: DatosDeCompra,
): Promise<OrdenCreada> {
  // Atajo del reintento. No alcanza solo: dos peticiones simultáneas pasan
  // por acá sin encontrar nada, y las frena el índice único (ver el `catch`).
  const yaCreada = await buscarPorClave(datos.idempotencyKey, datos.userId);
  if (yaCreada) return yaCreada;

  try {
    return await db.transaction(async (tx) => {
      const [carrito] = await tx.execute<{ id: string }>(sql`
        SELECT id FROM carts WHERE user_id = ${datos.userId}`);

      if (!carrito) {
        throw domainError("VALIDATION", {
          message: "Tu carrito está vacío. Agregá algo antes de confirmar.",
        });
      }

      // `FOR UPDATE OF ci`: solo el carrito; bloquear el catálogo trabaría a
      // toda la tienda. `ORDER BY variant_id` evita deadlocks (§8.3).
      const enElCarrito = [
        ...(await tx.execute<FilaDelCarrito>(sql`
          SELECT ci.variant_id     AS "variantId",
                 ci.quantity,
                 p.name            AS "productName",
                 b.name            AS "brandName",
                 c.name            AS "colorName",
                 p.final_price     AS "finalPrice",
                 p.is_active       AS "productoActivo",
                 v.is_active       AS "varianteActiva"
            FROM cart_items ci
            JOIN product_variants v ON v.id = ci.variant_id
            JOIN products p         ON p.id = v.product_id
            JOIN brands b           ON b.id = p.brand_id
            LEFT JOIN variant_colors c ON c.variant_id = v.id
           WHERE ci.cart_id = ${carrito.id}
           ORDER BY ci.variant_id
             FOR UPDATE OF ci`)),
      ];

      if (enElCarrito.length === 0) {
        throw domainError("VALIDATION", {
          message: "Tu carrito está vacío. Agregá algo antes de confirmar.",
        });
      }

      revisarQueSigaSiendoLoQueVio(datos.esperado, enElCarrito);

      // Con retiro la dirección queda NULL, y eso marca la forma de entrega.
      const direccion =
        datos.entrega.tipo === "envio"
          ? await snapshotDeDireccion(tx, datos.userId, datos.entrega.addressId)
          : null;

      const [orden] = await tx.execute<{ id: string; orderNumber: number }>(sql`
        INSERT INTO orders
          (user_id, origin, status, customer_name, customer_email,
           customer_phone, shipping_address, idempotency_key)
        VALUES
          (${datos.userId}, 'web', 'activa', ${datos.customerName},
           ${datos.customerEmail}, ${datos.customerPhone},
           ${direccion ? JSON.stringify(direccion) : null}::jsonb,
           ${datos.idempotencyKey})
        RETURNING id, order_number AS "orderNumber"`);

      for (const item of enElCarrito) {
        await tx.execute(sql`
          INSERT INTO order_items
            (order_id, variant_id, product_name, brand_name, color_name,
             unit_price, quantity)
          VALUES
            (${orden.id}, ${item.variantId}, ${item.productName},
             ${item.brandName}, ${item.colorName}, ${item.finalPrice},
             ${item.quantity})`);

        // Si no alcanza, la excepción revierte la orden entera.
        await reservar(tx, {
          variantId: item.variantId,
          quantity: item.quantity,
          orderId: orden.id,
          actorUserId: datos.userId,
          note: "Orden confirmada",
        }).catch((e: unknown) => {
          // Mismo código, con el nombre del producto en el mensaje.
          if (isDomainError(e) && e.code === "INSUFFICIENT_STOCK") {
            const nombre = item.colorName
              ? `${item.productName} (${item.colorName.toLowerCase()})`
              : item.productName;
            throw domainError("INSUFFICIENT_STOCK", {
              variantId: item.variantId,
              message: `Ya no queda stock suficiente de «${nombre}». Revisá el resumen y confirmá otra vez.`,
            });
          }
          throw e;
        });
      }

      // En SQL: un `reduce` en JavaScript perdería centavos (§7.1).
      await tx.execute(sql`
        UPDATE orders
           SET total = (SELECT COALESCE(SUM(subtotal), 0)
                          FROM order_items WHERE order_id = ${orden.id})
         WHERE id = ${orden.id}`);

      await tx.execute(sql`
        INSERT INTO order_status_history (order_id, from_status, to_status)
        VALUES (${orden.id}, NULL, 'activa')`);

      await tx.execute(sql`
        DELETE FROM cart_items WHERE cart_id = ${carrito.id}`);

      return {
        orderId: orden.id,
        orderNumber: orden.orderNumber,
        yaExistia: false,
      };
    });
  } catch (e) {
    // Otra petición con la misma clave ganó la carrera: se devuelve la suya.
    if (esDuplicado(e)) {
      const ganadora = await buscarPorClave(datos.idempotencyKey, datos.userId);
      if (ganadora) return ganadora;
    }
    throw e;
  }
}

/**
 * La reconfirmación de §8.4 paso 3. Junta todas las diferencias, no la
 * primera; lo no disponible se avisa antes que un cambio de precio.
 */
function revisarQueSigaSiendoLoQueVio(
  esperado: readonly ItemEsperado[],
  enElCarrito: readonly FilaDelCarrito[],
): void {
  const visto = new Map(esperado.map((i) => [i.variantId, i]));

  const noDisponibles: { variantId: string; productName: string }[] = [];
  const cambiosDePrecio: {
    variantId: string;
    productName: string;
    precioVisto: Money;
    precioVigente: Money;
  }[] = [];
  const sinVer: string[] = [];
  const cambiosDeCantidad: {
    variantId: string;
    cantidadVista: number;
    cantidadActual: number;
  }[] = [];

  for (const item of enElCarrito) {
    if (!item.productoActivo || !item.varianteActiva) {
      noDisponibles.push({
        variantId: item.variantId,
        productName: item.productName,
      });
      continue;
    }

    const loVisto = visto.get(item.variantId);

    if (loVisto === undefined) {
      // Agregado desde otra pestaña después de abrir el checkout.
      sinVer.push(item.variantId);
      continue;
    }

    visto.delete(item.variantId);

    if (loVisto.quantity !== item.quantity) {
      cambiosDeCantidad.push({
        variantId: item.variantId,
        cantidadVista: loVisto.quantity,
        cantidadActual: item.quantity,
      });
    }

    if (compare(loVisto.unitPrice, item.finalPrice) !== 0) {
      cambiosDePrecio.push({
        variantId: item.variantId,
        productName: item.productName,
        precioVisto: loVisto.unitPrice,
        precioVigente: item.finalPrice,
      });
    }
  }

  if (noDisponibles.length > 0) {
    throw domainError("PRODUCT_UNAVAILABLE", {
      items: noDisponibles,
      message:
        noDisponibles.length === 1
          ? `«${noDisponibles[0].productName}» ya no está disponible. Sacalo del carrito y volvé a confirmar.`
          : "Algunos productos ya no están disponibles. Revisá el carrito y volvé a confirmar.",
    });
  }

  // Lo que sobró en `visto` se quitó del carrito. Agregados, quitados y
  // cantidades son el mismo aviso: el carrito no es el que estás mirando.
  if (sinVer.length > 0 || visto.size > 0 || cambiosDeCantidad.length > 0) {
    throw domainError("PRICE_CHANGED", {
      agregados: sinVer,
      quitados: [...visto.keys()],
      cantidades: cambiosDeCantidad,
      message:
        "Tu carrito cambió mientras comprabas. Revisá el resumen y confirmá otra vez.",
    });
  }

  if (cambiosDePrecio.length > 0) {
    throw domainError("PRICE_CHANGED", { items: cambiosDePrecio });
  }
}

async function snapshotDeDireccion(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  addressId: string,
): Promise<ShippingAddressSnapshot> {
  // Sin el `user_id` se podría usar la dirección de otro cambiando el id (§13.8).
  const [d] = await tx.execute<ShippingAddressSnapshot>(sql`
    SELECT recipient_name AS "recipientName",
           phone,
           street,
           number,
           apartment,
           notes,
           city,
           province,
           postal_code AS "postalCode"
      FROM addresses
     WHERE id = ${addressId}
       AND user_id = ${userId}
       AND deleted_at IS NULL`);

  if (!d) throw domainError("NOT_FOUND");

  return d;
}
