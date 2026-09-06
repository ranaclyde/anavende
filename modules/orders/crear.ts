import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { domainError } from "@/lib/errors";
import { compare, type Money } from "@/lib/money";
import { reservar } from "@/modules/stock/operaciones";

/**
 * Creación de orden desde el carrito — FS RF-11, RF-12 · TS §8.4, §8.5.
 * Tarea F4.3.
 *
 * Es el procedimiento de §8.4, en ese orden y por ese motivo:
 *
 *     1. Releer el carrito con FOR UPDATE
 *     2. Releer precios, disponibilidad y estado del catálogo
 *     3. ¿Cambió algo respecto de lo que el comprador vio? → se pide reconfirmar
 *     4. INSERT orders          (snapshot del comprador y la dirección)
 *     5. INSERT order_items     (snapshot de nombre, marca, color y precio)
 *     6. Reservar, ordenado por variant_id
 *     7. UPDATE orders.total = SUM(subtotal), en SQL
 *     8. INSERT order_status_history (NULL → activa)
 *     9. DELETE cart_items
 *
 * **Abre su propia transacción en vez de recibir una**, al revés que el resto
 * del módulo, y es por la idempotencia: cuando dos peticiones con la misma
 * clave chocan contra el índice único, la que pierde queda con la transacción
 * abortada y hay que **leer de nuevo** la orden que ganó para devolverla. Una
 * transacción abortada no puede consultar nada, así que esa relectura tiene
 * que pasar afuera.
 *
 * **Lo que NO se hace acá:** el email E4 y el `revalidateTag` van DESPUÉS del
 * COMMIT (§8.3 regla 4 y 5), en la capa de acciones. Un email adentro de la
 * transacción la mantiene abierta mientras se habla con Resend, y si el envío
 * falla se revierte una orden que el comprador ya dio por hecha. Tampoco se
 * comprueba el email verificado de RF-11 ni el permiso: eso vive en
 * `lib/action.ts`, que es quien tiene la sesión.
 */

/** Lo que el comprador vio en el resumen, y contra lo que se compara (§8.4 paso 3). */
export type ItemEsperado = {
  variantId: string;
  /** El precio final YA con descuento, tal como se le mostró. */
  unitPrice: Money;
};

export type DatosDeCompra = {
  userId: string;
  /** Generada al abrir el checkout, no al confirmar (§8.5). */
  idempotencyKey: string;
  addressId: string;
  // Snapshot del comprador (RN-12): la orden se lee igual dentro de un año.
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  esperado: readonly ItemEsperado[];
};

export type OrdenCreada = {
  orderId: string;
  orderNumber: number;
  /** `true` si la clave ya había creado esta orden: fue un reintento (§8.5). */
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

/** Postgres devuelve 23505 y Drizzle lo envuelve, igual que en el catálogo. */
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

async function buscarPorClave(clave: string): Promise<OrdenCreada | null> {
  const [fila] = await db.execute<{ id: string; orderNumber: number }>(sql`
    SELECT id, order_number AS "orderNumber"
      FROM orders WHERE idempotency_key = ${clave}`);

  return fila
    ? { orderId: fila.id, orderNumber: fila.orderNumber, yaExistia: true }
    : null;
}

export async function crearOrdenDesdeCarrito(
  datos: DatosDeCompra,
): Promise<OrdenCreada> {
  // El camino barato del reintento: si la clave ya creó una orden, se
  // devuelve y no se abre nada. No alcanza por sí solo —dos peticiones a la
  // vez pasan las dos por acá sin encontrar nada—, y para eso está el índice
  // único más abajo.
  const yaCreada = await buscarPorClave(datos.idempotencyKey);
  if (yaCreada) return yaCreada;

  try {
    return await db.transaction(async (tx) => {
      // ── 1. El carrito, bloqueado ───────────────────────────────────────
      const [carrito] = await tx.execute<{ id: string }>(sql`
        SELECT id FROM carts WHERE user_id = ${datos.userId}`);

      if (!carrito) {
        throw domainError("VALIDATION", {
          message: "Tu carrito está vacío. Agregá algo antes de confirmar.",
        });
      }

      // ── 2. Precios, disponibilidad y estado, de una sola consulta ──────
      //
      // `FOR UPDATE OF ci` bloquea SOLO las filas del carrito (§8.4 paso 1):
      // bloquear también el catálogo trabaría a toda la tienda mientras
      // alguien confirma. Y `ORDER BY variant_id` es §8.3 regla 2 — el orden
      // determinístico que impide que dos órdenes con los mismos productos se
      // traben mutuamente.
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
            LEFT JOIN colors c      ON c.id = v.color_id
           WHERE ci.cart_id = ${carrito.id}
           ORDER BY ci.variant_id
             FOR UPDATE OF ci`)),
      ];

      if (enElCarrito.length === 0) {
        throw domainError("VALIDATION", {
          message: "Tu carrito está vacío. Agregá algo antes de confirmar.",
        });
      }

      // ── 3. ¿Cambió algo respecto de lo que vio? ────────────────────────
      revisarQueSigaSiendoLoQueVio(datos.esperado, enElCarrito);

      // ── 4. La orden, con el snapshot del comprador y la dirección ──────
      const direccion = await snapshotDeDireccion(tx, datos);

      const [orden] = await tx.execute<{ id: string; orderNumber: number }>(sql`
        INSERT INTO orders
          (user_id, origin, status, customer_name, customer_email,
           customer_phone, shipping_address, idempotency_key)
        VALUES
          (${datos.userId}, 'web', 'activa', ${datos.customerName},
           ${datos.customerEmail}, ${datos.customerPhone},
           ${JSON.stringify(direccion)}::jsonb, ${datos.idempotencyKey})
        RETURNING id, order_number AS "orderNumber"`);

      // ── 5 y 6. Los ítems y sus reservas, en el orden que ya trae ───────
      for (const item of enElCarrito) {
        await tx.execute(sql`
          INSERT INTO order_items
            (order_id, variant_id, product_name, brand_name, color_name,
             unit_price, quantity)
          VALUES
            (${orden.id}, ${item.variantId}, ${item.productName},
             ${item.brandName}, ${item.colorName}, ${item.finalPrice},
             ${item.quantity})`);

        // Acá se decide quién se queda con la última unidad (§8.2). Si no
        // alcanza, la excepción revierte la orden entera: todo o nada
        // (§8.3 regla 1).
        await reservar(tx, {
          variantId: item.variantId,
          quantity: item.quantity,
          orderId: orden.id,
          actorUserId: datos.userId,
          note: "Orden confirmada",
        });
      }

      // ── 7. El total, sumado EN SQL ─────────────────────────────────────
      //
      // §7.1: los montos son `numeric(12,2)` y se suman en la base. Un
      // `reduce` en JavaScript sobre estos mismos números perdería centavos, y
      // ese error no se ve hasta que una orden no cierra.
      await tx.execute(sql`
        UPDATE orders
           SET total = (SELECT COALESCE(SUM(subtotal), 0)
                          FROM order_items WHERE order_id = ${orden.id})
         WHERE id = ${orden.id}`);

      // ── 8. El historial arranca acá ────────────────────────────────────
      await tx.execute(sql`
        INSERT INTO order_status_history (order_id, from_status, to_status)
        VALUES (${orden.id}, NULL, 'activa')`);

      // ── 9. El carrito se vacía ─────────────────────────────────────────
      await tx.execute(sql`
        DELETE FROM cart_items WHERE cart_id = ${carrito.id}`);

      return {
        orderId: orden.id,
        orderNumber: orden.orderNumber,
        yaExistia: false,
      };
    });
  } catch (e) {
    // El otro camino de la idempotencia: otra petición con la misma clave
    // ganó la carrera mientras esta armaba su orden. La suya es la buena.
    if (esDuplicado(e)) {
      const ganadora = await buscarPorClave(datos.idempotencyKey);
      if (ganadora) return ganadora;
    }
    throw e;
  }
}

/**
 * El paso 3 de §8.4, que es la reconfirmación de RF-11.
 *
 * Se juntan TODAS las diferencias antes de largar el error, no la primera:
 * quien está por confirmar tiene que ver de una lo que cambió, no descubrirlo
 * de a un producto por intento.
 *
 * Lo no disponible pesa más que lo caro: si hay algo que ya no se vende, ese
 * es el problema a resolver primero, y avisar del precio de otra cosa antes
 * sería mandar a la persona por el camino largo.
 */
function revisarQueSigaSiendoLoQueVio(
  esperado: readonly ItemEsperado[],
  enElCarrito: readonly FilaDelCarrito[],
): void {
  const visto = new Map(esperado.map((i) => [i.variantId, i.unitPrice]));

  const noDisponibles: { variantId: string; productName: string }[] = [];
  const cambiosDePrecio: {
    variantId: string;
    productName: string;
    precioVisto: Money;
    precioVigente: Money;
  }[] = [];
  const sinVer: string[] = [];

  for (const item of enElCarrito) {
    if (!item.productoActivo || !item.varianteActiva) {
      noDisponibles.push({
        variantId: item.variantId,
        productName: item.productName,
      });
      continue;
    }

    const precioVisto = visto.get(item.variantId);

    if (precioVisto === undefined) {
      // Está en el carrito y no en el resumen: se agregó desde otra pestaña
      // después de abrir el checkout. Confirmar así le cobraría algo que
      // nunca vio.
      sinVer.push(item.variantId);
      continue;
    }

    visto.delete(item.variantId);

    if (compare(precioVisto, item.finalPrice) !== 0) {
      cambiosDePrecio.push({
        variantId: item.variantId,
        productName: item.productName,
        precioVisto,
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

  // Lo que sobró en `visto` estaba en el resumen y ya no está en el carrito;
  // lo de `sinVer`, al revés. Las dos cosas son el mismo aviso: el carrito no
  // es el que estás mirando.
  if (sinVer.length > 0 || visto.size > 0) {
    throw domainError("PRICE_CHANGED", {
      agregados: sinVer,
      quitados: [...visto.keys()],
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
  datos: DatosDeCompra,
): Promise<ShippingAddressSnapshot> {
  // Del usuario, y no borrada. Sin el `user_id` en el WHERE, alguien podría
  // mandarse a enviar a la dirección de otro con sólo cambiar el id (§13.8:
  // sin RLS, el filtro en la aplicación es la única barrera).
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
     WHERE id = ${datos.addressId}
       AND user_id = ${datos.userId}
       AND deleted_at IS NULL`);

  if (!d) throw domainError("NOT_FOUND");

  // Se copia, no se referencia (RN-12): la orden tiene que leerse igual
  // aunque mañana se edite o se borre la dirección.
  return d;
}
