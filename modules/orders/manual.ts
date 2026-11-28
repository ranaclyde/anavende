import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { domainError, isDomainError } from "@/lib/errors";
import { todayInArgentina, TIME_ZONE } from "@/lib/dates";
import type { Money } from "@/lib/money";
import {
  reservar,
  vender,
  type Transaccion,
} from "@/modules/stock/operaciones";

/**
 * Alta de una orden manual (RF-24): sin carrito ni reconfirmación, con el
 * precio que pone la vendedora y sin clave de idempotencia. Si nace
 * finalizada, vende sin pasar por la reserva y el stock puede quedar negativo (§5.4).
 */

export type ItemManual = {
  variantId: string;
  quantity: number;
  /** El acordado, que puede no ser el del catálogo. */
  unitPrice: Money;
};

export type DatosDeOrdenManual = {
  creadaPor: string;
  userId: string | null;
  estado: "activa" | "finalizada";
  /** `AAAA-MM-DD`, solo si nace finalizada. `null` u hoy es «ahora». */
  fechaDeVenta?: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  /** `null` es retiro. */
  direccion: ShippingAddressSnapshot | null;
  notas: string | null;
  items: readonly ItemManual[];
};

type VarianteParaLaOrden = {
  variantId: string;
  productName: string;
  brandName: string;
  colorName: string | null;
};

async function snapshotDeLasVariantes(
  tx: Transaccion,
  ids: readonly string[],
): Promise<Map<string, VarianteParaLaOrden>> {
  const filas = await tx.execute<VarianteParaLaOrden>(sql`
    SELECT v.id        AS "variantId",
           p.name      AS "productName",
           b.name      AS "brandName",
           c.name      AS "colorName"
      FROM product_variants v
      JOIN products p    ON p.id = v.product_id
      JOIN brands b      ON b.id = p.brand_id
      LEFT JOIN variant_colors c ON c.variant_id = v.id
     WHERE v.id IN (${sql.join(
       ids.map((id) => sql`${id}::uuid`),
       sql`, `,
     )})`);

  return new Map([...filas].map((f) => [f.variantId, f]));
}

/**
 * El `finalized_at`: hoy es `now()`; un día anterior, ese día a las 12:00 de
 * Argentina, que no cambia de día con ninguna zona horaria (§5.6).
 */
function cuandoSeVendio(datos: DatosDeOrdenManual): SQL {
  if (datos.estado !== "finalizada") return sql`NULL`;

  const hoy = todayInArgentina();
  const fecha = datos.fechaDeVenta;
  if (!fecha || fecha === hoy) return sql`now()`;

  if (fecha > hoy) {
    throw domainError("VALIDATION", {
      message: "La fecha de la venta no puede ser futura.",
    });
  }
  return sql`(${fecha}::date + time '12:00') AT TIME ZONE ${TIME_ZONE}`;
}

/** Abre su propia transacción: la orden entera, o ninguna. */
export async function crearOrdenManual(
  datos: DatosDeOrdenManual,
): Promise<{ orderId: string; orderNumber: number }> {
  if (datos.items.length === 0) {
    throw domainError("VALIDATION", {
      message: "Agregá al menos un producto a la orden.",
    });
  }

  // Por `variant_id`, para evitar deadlocks (§8.3).
  const items = [...datos.items].sort((a, b) =>
    a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0,
  );

  return db.transaction(async (tx) => {
    const catalogo = await snapshotDeLasVariantes(
      tx,
      items.map((i) => i.variantId),
    );

    const faltante = items.find((i) => !catalogo.has(i.variantId));
    if (faltante) {
      throw domainError("NOT_FOUND", {
        message:
          "Uno de los productos de la orden ya no está en el catálogo. " +
          "Quitalo de la lista y volvé a buscarlo.",
      });
    }

    const [orden] = await tx.execute<{ id: string; orderNumber: number }>(sql`
      INSERT INTO orders
        (user_id, origin, status, customer_name, customer_email,
         customer_phone, shipping_address, notes, created_by, finalized_at)
      VALUES
        (${datos.userId}, 'manual', ${datos.estado}, ${datos.customerName},
         ${datos.customerEmail}, ${datos.customerPhone},
         ${datos.direccion ? JSON.stringify(datos.direccion) : null}::jsonb,
         ${datos.notas}, ${datos.creadaPor},
         ${cuandoSeVendio(datos)})
      RETURNING id, order_number AS "orderNumber"`);

    for (const item of items) {
      const v = catalogo.get(item.variantId)!;

      await tx.execute(sql`
        INSERT INTO order_items
          (order_id, variant_id, product_name, brand_name, color_name,
           unit_price, quantity)
        VALUES
          (${orden.id}, ${item.variantId}, ${v.productName}, ${v.brandName},
           ${v.colorName}, ${item.unitPrice}, ${item.quantity})`);

      await moverElStock(tx, {
        estado: datos.estado,
        item,
        nombre: v.colorName
          ? `${v.productName} (${v.colorName.toLowerCase()})`
          : v.productName,
        orderId: orden.id,
        actorUserId: datos.creadaPor,
      });
    }

    // En SQL: un `reduce` en JavaScript perdería centavos (§7.1).
    await tx.execute(sql`
      UPDATE orders
         SET total = (SELECT COALESCE(SUM(subtotal), 0)
                        FROM order_items WHERE order_id = ${orden.id})
       WHERE id = ${orden.id}`);

    // Una sola fila: si nace finalizada, nunca estuvo activa.
    await tx.execute(sql`
      INSERT INTO order_status_history
        (order_id, from_status, to_status, actor_user_id)
      VALUES (${orden.id}, NULL, ${datos.estado}, ${datos.creadaPor})`);

    return { orderId: orden.id, orderNumber: orden.orderNumber };
  });
}

/**
 * Activa reserva, y sin stock libre falla (no es el «advierte sin bloquear» de
 * RF-24). Finalizada vende sin reserva y el total puede quedar negativo.
 */
async function moverElStock(
  tx: Transaccion,
  args: {
    estado: "activa" | "finalizada";
    item: ItemManual;
    nombre: string;
    orderId: string;
    actorUserId: string;
  },
): Promise<void> {
  const comun = {
    variantId: args.item.variantId,
    quantity: args.item.quantity,
    orderId: args.orderId,
    actorUserId: args.actorUserId,
  };

  try {
    if (args.estado === "activa") {
      await reservar(tx, { ...comun, note: "Orden manual" });
    } else {
      await vender(tx, {
        ...comun,
        desdeReserva: false,
        note: "Orden manual finalizada",
      });
    }
  } catch (e: unknown) {
    if (!isDomainError(e) || e.code !== "INSUFFICIENT_STOCK") throw e;

    throw domainError("INSUFFICIENT_STOCK", {
      variantId: args.item.variantId,
      message:
        args.estado === "activa"
          ? `No hay stock libre suficiente de «${args.nombre}» para reservarlo. ` +
            "Si la venta ya se hizo, cargala como finalizada; si no, ajustá el stock primero."
          : `Esa cantidad de «${args.nombre}» dejaría el stock por debajo de lo ` +
            "reservado en órdenes activas. Resolvé esas órdenes primero.",
    });
  }
}
