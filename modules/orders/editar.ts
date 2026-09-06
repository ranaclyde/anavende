import "server-only";

import { sql } from "drizzle-orm";

import { domainError } from "@/lib/errors";
import { cancelarOrden } from "@/modules/orders/estados";
import { liberar, type Transaccion } from "@/modules/stock/operaciones";

/**
 * Edición de una orden activa — FS RF-22 · TS §8.1. Tarea F4.4.
 *
 * La vendedora completa una orden parcialmente: quita lo que no puede entregar
 * o entrega menos. Lo que se libera vuelve a estar disponible **de inmediato**,
 * que es el punto — una unidad reservada para algo que ya se sabe que no se va
 * a entregar es una unidad que no se le puede vender a nadie.
 *
 * Tres reglas, y las tres se hacen cumplir acá:
 *
 * **Sólo órdenes activas.** La orden se bloquea con `FOR UPDATE` antes de
 * mirarle el estado. Sin ese bloqueo, entre leer «está activa» y liberar la
 * reserva, otra transacción puede finalizarla: se descontaría el stock por la
 * cantidad vieja y además se liberaría una reserva que la venta ya consumió.
 *
 * **Quitar el último ítem cancela la orden** (RF-22), y no en silencio: hay
 * que pedirlo explícitamente. Si no se pide, la función se niega y avisa que
 * eso es lo que va a pasar, para que la pantalla pueda preguntar. Una orden
 * que se cancela sola porque alguien quitó un renglón es una orden cancelada
 * por accidente.
 *
 * **El total se recalcula en SQL** (§7.1), nunca restando en JavaScript.
 *
 * ── El historial ────────────────────────────────────────────────────────
 *
 * RF-22 pide que el cambio «quede registrado en el historial de la orden», y
 * el único historial que existe es `order_status_history`. Una edición no es
 * un cambio de estado, así que se escribe como `activa → activa` con el motivo
 * contando qué pasó. Es un uso ensanchado de esa tabla y queda dicho: la
 * alternativa era una segunda tabla de historial, y entonces la pantalla de la
 * orden tendría que unir dos líneas de tiempo para mostrar una.
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

/** Bloquea la orden y exige que esté activa. Todo lo demás depende de esto. */
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
      message: "Sólo se pueden editar órdenes activas. Actualizá la página.",
    });
  }
}

async function elItem(
  tx: Transaccion,
  ctx: Contexto,
): Promise<ItemVivo> {
  // El `order_id` en el WHERE no es redundante: sin él, un id de ítem de otra
  // orden editaría esa otra orden con los permisos de esta.
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

/** «Teclado Mecánico (Negro)», para que el historial se lea sin ir a buscar ids. */
function nombrar(item: ItemVivo): string {
  return item.colorName
    ? `${item.productName} (${item.colorName})`
    : item.productName;
}

// ── Quitar un ítem (RF-22) ──────────────────────────────────────────────

export type ResultadoDeQuitar = {
  /** `true` si era el último y la orden quedó cancelada. */
  ordenCancelada: boolean;
};

export async function quitarItem(
  tx: Transaccion,
  args: Contexto & {
    /**
     * Tiene que venir en `true` para que quitar el ÚLTIMO ítem cancele la
     * orden. Es la «confirmación explícita» de RF-22, hecha cumplir por el
     * dominio y no sólo dibujada en la pantalla.
     */
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

  // Se libera DESPUÉS de borrar el renglón y con la cantidad que tenía. Una
  // variante ya borrada llega con `variant_id` en NULL y no hay nada que
  // liberar (§5.6).
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
    // Una orden sin ítems no es una orden: se cancela. `cancelarOrden` no
    // tiene ya nada que liberar —el único ítem se fue recién— y por eso el
    // orden importa: al revés, liberaría dos veces.
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

// ── Reducir la cantidad de un ítem (RF-22) ──────────────────────────────

export async function reducirCantidad(
  tx: Transaccion,
  args: Contexto & { nuevaCantidad: number; reason?: string | null },
): Promise<void> {
  if (!Number.isInteger(args.nuevaCantidad) || args.nuevaCantidad < 1) {
    // Bajar a cero es quitar el ítem, y quitar el ítem puede cancelar la
    // orden: son dos acciones distintas con dos confirmaciones distintas, y
    // colarse de una a la otra por un cero sería cancelar sin preguntar.
    throw domainError("VALIDATION", {
      message:
        "La cantidad tiene que ser de uno para arriba. Para sacarlo del todo, quitá el producto.",
    });
  }

  await exigirOrdenActiva(tx, args.orderId);
  const item = await elItem(tx, args);

  if (args.nuevaCantidad > item.quantity) {
    // RF-22 habla de reducir. Agregar unidades es otra cosa —hay que reservar,
    // y puede no haber stock—, y no está en el MVP.
    throw domainError("VALIDATION", {
      message: `No se puede agregar unidades desde acá: la orden tiene ${item.quantity} y sólo se puede bajar.`,
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
