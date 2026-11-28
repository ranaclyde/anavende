import "server-only";

import { sql } from "drizzle-orm";

import { domainError, isDomainError } from "@/lib/errors";
import { cancelarOrden } from "@/modules/orders/estados";
import {
  liberar,
  reservar,
  type Transaccion,
} from "@/modules/stock/operaciones";

/**
 * Edición de una orden activa (RF-22). Quitar libera y no falla; sumar reserva
 * y, si no alcanza, se niega (no advierte como la orden manual).
 *
 * La orden se bloquea con `FOR UPDATE` antes de mirarle el estado: sin eso,
 * otra transacción podría finalizarla en el medio y se liberaría una reserva
 * que la venta ya consumió.
 *
 * Las ediciones se anotan en `order_status_history` como `activa → activa`.
 */

type Contexto = {
  orderId: string;
  orderItemId: string;
  actorUserId?: string | null;
};

type ItemVivo = {
  variantId: string | null;
  quantity: number;
  productName: string;
  colorName: string | null;
};

async function exigirOrdenActiva(
  tx: Transaccion,
  orderId: string,
): Promise<void> {
  const [orden] = await tx.execute<{ status: string }>(sql`
    SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`);

  if (!orden) throw domainError("NOT_FOUND");

  if (orden.status !== "activa") {
    throw domainError("INVALID_ORDER_STATE", {
      estadoActual: orden.status,
      message: "Solo se pueden editar órdenes activas. Actualizá la página.",
    });
  }
}

async function elItem(tx: Transaccion, ctx: Contexto): Promise<ItemVivo> {
  // El `order_id` no es redundante: sin él, un ítem de otra orden se editaría
  // con el bloqueo y los chequeos de esta.
  const [item] = await tx.execute<ItemVivo>(sql`
    SELECT variant_id   AS "variantId",
           quantity,
           product_name AS "productName",
           color_name   AS "colorName"
      FROM order_items
     WHERE id = ${ctx.orderItemId} AND order_id = ${ctx.orderId}`);

  if (!item) throw domainError("NOT_FOUND");
  return item;
}

async function cuantosItemsQuedan(
  tx: Transaccion,
  orderId: string,
): Promise<number> {
  const [fila] = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM order_items WHERE order_id = ${orderId}`);
  return fila.n;
}

async function recalcularTotal(
  tx: Transaccion,
  orderId: string,
): Promise<void> {
  await tx.execute(sql`
    UPDATE orders
       SET total = (SELECT COALESCE(SUM(subtotal), 0)
                      FROM order_items WHERE order_id = ${orderId}),
           updated_at = now()
     WHERE id = ${orderId}`);
}

async function anotarEnElHistorial(
  tx: Transaccion,
  args: { orderId: string; reason: string; actorUserId?: string | null },
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO order_status_history
      (order_id, from_status, to_status, reason, actor_user_id)
    VALUES
      (${args.orderId}, 'activa', 'activa', ${args.reason},
       ${args.actorUserId ?? null})`);
}

/** «Teclado Mecánico (Negro)». */
function nombrar(item: ItemVivo): string {
  return item.colorName
    ? `${item.productName} (${item.colorName})`
    : item.productName;
}

export type ResultadoDeQuitar = {
  ordenCancelada: boolean;
};

export async function quitarItem(
  tx: Transaccion,
  args: Contexto & {
    /** Sin `true`, quitar el último ítem se rechaza en vez de cancelar la orden. */
    permitirCancelar?: boolean;
    reason?: string | null;
  },
): Promise<ResultadoDeQuitar> {
  await exigirOrdenActiva(tx, args.orderId);
  const item = await elItem(tx, args);

  const esElUltimo = (await cuantosItemsQuedan(tx, args.orderId)) === 1;

  if (esElUltimo && !args.permitirCancelar) {
    throw domainError("VALIDATION", {
      cancelaLaOrden: true,
      message:
        "Es el único producto de la orden: quitarlo la cancela. Confirmá la cancelación.",
    });
  }

  await tx.execute(sql`
    DELETE FROM order_items WHERE id = ${args.orderItemId}`);

  // Se libera después de borrar el renglón; ver la cancelación de abajo.
  if (item.variantId) {
    await liberar(tx, {
      variantId: item.variantId,
      quantity: item.quantity,
      orderId: args.orderId,
      actorUserId: args.actorUserId,
      note: `Se quitó «${nombrar(item)}» de la orden`,
    });
  }

  if (esElUltimo) {
    // El renglón ya se borró, así que `cancelarOrden` no tiene nada que
    // liberar. Al revés, se liberaría dos veces.
    await cancelarOrden(tx, {
      orderId: args.orderId,
      actorUserId: args.actorUserId,
      reason:
        args.reason ??
        `Se quitó «${nombrar(item)}», que era el único producto de la orden`,
    });
    await recalcularTotal(tx, args.orderId);
    return { ordenCancelada: true };
  }

  await recalcularTotal(tx, args.orderId);
  await anotarEnElHistorial(tx, {
    orderId: args.orderId,
    reason: args.reason ?? `Se quitó «${nombrar(item)}»`,
    actorUserId: args.actorUserId,
  });

  return { ordenCancelada: false };
}

export async function reducirCantidad(
  tx: Transaccion,
  args: Contexto & { nuevaCantidad: number; reason?: string | null },
): Promise<void> {
  if (!Number.isInteger(args.nuevaCantidad) || args.nuevaCantidad < 1) {
    // Bajar a cero sería quitar el ítem, y podría cancelar la orden sin preguntar.
    throw domainError("VALIDATION", {
      message:
        "La cantidad tiene que ser de uno para arriba. Para sacarlo del todo, quitá el producto.",
    });
  }

  await exigirOrdenActiva(tx, args.orderId);
  const item = await elItem(tx, args);

  if (args.nuevaCantidad > item.quantity) {
    // Subir tiene que reservar: es `aumentarCantidad`.
    throw domainError("VALIDATION", {
      message: `No se pueden agregar unidades desde acá: la orden tiene ${item.quantity} y solo se puede bajar.`,
    });
  }

  const deMenos = item.quantity - args.nuevaCantidad;
  if (deMenos === 0) return;

  await tx.execute(sql`
    UPDATE order_items SET quantity = ${args.nuevaCantidad}
     WHERE id = ${args.orderItemId}`);

  if (item.variantId) {
    await liberar(tx, {
      variantId: item.variantId,
      quantity: deMenos,
      orderId: args.orderId,
      actorUserId: args.actorUserId,
      note: `«${nombrar(item)}» pasó de ${item.quantity} a ${args.nuevaCantidad}`,
    });
  }

  await recalcularTotal(tx, args.orderId);
  await anotarEnElHistorial(tx, {
    orderId: args.orderId,
    reason:
      args.reason ??
      `«${nombrar(item)}» pasó de ${item.quantity} a ${args.nuevaCantidad}`,
    actorUserId: args.actorUserId,
  });
}

const MAXIMO_POR_RENGLON = 9999;

function exigirCantidad(cantidad: number, que: string): void {
  if (
    !Number.isInteger(cantidad) ||
    cantidad < 1 ||
    cantidad > MAXIMO_POR_RENGLON
  ) {
    throw domainError("VALIDATION", {
      message: `${que} tiene que ser un número de 1 a ${MAXIMO_POR_RENGLON}.`,
    });
  }
}

/** Si la reserva no alcanza, el `INSUFFICIENT_STOCK` dice cuál es y cuántas quedan. */
async function reservarODecirCuantoHay(
  tx: Transaccion,
  args: {
    variantId: string;
    quantity: number;
    orderId: string;
    actorUserId?: string | null;
    note: string;
    nombre: string;
  },
): Promise<void> {
  try {
    await reservar(tx, {
      variantId: args.variantId,
      quantity: args.quantity,
      orderId: args.orderId,
      actorUserId: args.actorUserId,
      note: args.note,
    });
  } catch (e: unknown) {
    if (!isDomainError(e) || e.code !== "INSUFFICIENT_STOCK") throw e;

    const [fila] = await tx.execute<{ disponible: number }>(sql`
      SELECT stock_total - reserved_stock AS disponible
        FROM product_variants WHERE id = ${args.variantId}`);
    const hay = fila?.disponible ?? 0;

    throw domainError("INSUFFICIENT_STOCK", {
      variantId: args.variantId,
      message:
        hay > 0
          ? `Solo ${hay === 1 ? "queda 1 unidad" : `quedan ${hay} unidades`} de «${args.nombre}», y hacen falta ${args.quantity}. Si va a entrar mercadería, cargá el stock primero.`
          : `No queda stock de «${args.nombre}». Si va a entrar mercadería, cargá el stock primero.`,
    });
  }
}

/** Reserva la diferencia; las unidades nuevas van al precio del renglón. */
export async function aumentarCantidad(
  tx: Transaccion,
  args: Contexto & { nuevaCantidad: number },
): Promise<void> {
  exigirCantidad(args.nuevaCantidad, "La cantidad");

  await exigirOrdenActiva(tx, args.orderId);
  const item = await elItem(tx, args);

  if (args.nuevaCantidad < item.quantity) {
    throw domainError("VALIDATION", {
      message: `Esto solo sube: la orden tiene ${item.quantity}. Para bajar, usá el botón de quitar unidades.`,
    });
  }

  const deMas = args.nuevaCantidad - item.quantity;
  if (deMas === 0) return;

  // Variante borrada: no hay contador donde reservar.
  if (!item.variantId) {
    throw domainError("VALIDATION", {
      message: `«${nombrar(item)}» ya no está en el catálogo, así que no se le pueden sumar unidades.`,
    });
  }

  const paso = `«${nombrar(item)}» pasó de ${item.quantity} a ${args.nuevaCantidad}`;

  await reservarODecirCuantoHay(tx, {
    variantId: item.variantId,
    quantity: deMas,
    orderId: args.orderId,
    actorUserId: args.actorUserId,
    note: paso,
    nombre: nombrar(item),
  });

  await tx.execute(sql`
    UPDATE order_items SET quantity = ${args.nuevaCantidad}
     WHERE id = ${args.orderItemId}`);

  await recalcularTotal(tx, args.orderId);
  await anotarEnElHistorial(tx, {
    orderId: args.orderId,
    reason: paso,
    actorUserId: args.actorUserId,
  });
}

export type ResultadoDeAgregar = {
  /** `true` si la variante ya estaba y se sumó sobre su renglón. */
  sumadoAlRenglon: boolean;
  cantidad: number;
};

/**
 * Si la variante ya está, suma sobre su renglón y a su precio; si no, entra
 * un renglón nuevo al precio vigente.
 */
export async function agregarItem(
  tx: Transaccion,
  args: {
    orderId: string;
    variantId: string;
    cantidad: number;
    actorUserId?: string | null;
  },
): Promise<ResultadoDeAgregar> {
  exigirCantidad(args.cantidad, "La cantidad");
  await exigirOrdenActiva(tx, args.orderId);

  // Una orden manual puede tener la misma variante en dos renglones: el más viejo.
  const [existente] = await tx.execute<{ id: string; quantity: number }>(sql`
    SELECT id, quantity
      FROM order_items
     WHERE order_id = ${args.orderId} AND variant_id = ${args.variantId}
     ORDER BY created_at, id
     LIMIT 1`);

  if (existente) {
    const cantidad = existente.quantity + args.cantidad;
    await aumentarCantidad(tx, {
      orderId: args.orderId,
      orderItemId: existente.id,
      actorUserId: args.actorUserId,
      nuevaCantidad: cantidad,
    });
    return { sumadoAlRenglon: true, cantidad };
  }

  const [v] = await tx.execute<{
    productName: string;
    brandName: string;
    colorName: string | null;
    finalPrice: string;
  }>(sql`
    SELECT p.name        AS "productName",
           b.name        AS "brandName",
           c.name        AS "colorName",
           p.final_price AS "finalPrice"
      FROM product_variants v
      JOIN products p    ON p.id = v.product_id
      JOIN brands b      ON b.id = p.brand_id
      LEFT JOIN variant_colors c ON c.variant_id = v.id
     WHERE v.id = ${args.variantId}`);

  if (!v) throw domainError("NOT_FOUND");

  const nombre = v.colorName
    ? `${v.productName} (${v.colorName})`
    : v.productName;

  await reservarODecirCuantoHay(tx, {
    variantId: args.variantId,
    quantity: args.cantidad,
    orderId: args.orderId,
    actorUserId: args.actorUserId,
    note: `Se agregó «${nombre}» ×${args.cantidad}`,
    nombre,
  });

  await tx.execute(sql`
    INSERT INTO order_items
      (order_id, variant_id, product_name, brand_name, color_name,
       unit_price, quantity)
    VALUES
      (${args.orderId}, ${args.variantId}, ${v.productName}, ${v.brandName},
       ${v.colorName}, ${v.finalPrice}, ${args.cantidad})`);

  await recalcularTotal(tx, args.orderId);
  await anotarEnElHistorial(tx, {
    orderId: args.orderId,
    reason: `Se agregó «${nombre}» ×${args.cantidad}`,
    actorUserId: args.actorUserId,
  });

  return { sumadoAlRenglon: false, cantidad: args.cantidad };
}
