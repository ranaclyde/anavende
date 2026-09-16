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
 * Edición de una orden activa — FS RF-22 · TS §8.1.
 * Tareas F4.4 (quitar y reducir) y F7.2a (sumar y agregar).
 *
 * La vendedora ajusta la orden contra lo que se terminó acordando por
 * WhatsApp, y eso va en los dos sentidos: quita lo que no puede entregar, y
 * suma lo que el comprador pidió después.
 *
 * **Las dos mitades no son simétricas, y por eso llegaron en tareas
 * distintas.** Quitar siempre se puede: libera una reserva y no puede fallar,
 * y lo que se libera vuelve a estar disponible de inmediato —una unidad
 * apartada para algo que ya se sabe que no se entrega es una unidad que no se
 * le puede vender a nadie—. Sumar **puede no poderse**: hay que reservar, y el
 * stock puede no estar. Ahí no se advierte y se deja pasar como en la orden
 * manual (RF-24, donde la venta ya ocurrió): se niega y se dice cuánto hay,
 * porque reservar de más rompe el invariante que evita vender dos veces la
 * misma unidad (§8.1).
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

async function elItem(tx: Transaccion, ctx: Contexto): Promise<ItemVivo> {
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
    // Esta función reduce, y sólo reduce. Sumar es otra cosa —hay que
    // reservar, y el stock puede no estar—, así que es su propia operación:
    // **F7.2a** (RF-22, «Criterios — sumar»). Hasta que exista, acá se
    // rechaza en vez de dejar pasar un número más grande sin reservar nada.
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

// ── Sumar (RF-22, «Criterios — sumar») ──────────────────────────────────

/** Lo mismo que al reducir: una orden no lleva diez mil unidades de nada. */
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

/**
 * Reserva, y si no alcanza dice **cuánto hay** — RF-22 lo pide con esas
 * palabras: «si no hay stock disponible, no se agrega, y se dice cuánto hay».
 *
 * El mensaje de siempre (`INSUFFICIENT_STOCK`) habla de «ese producto» y de
 * revisar el carrito, porque nació para el comprador. Acá quien lee está
 * mirando una orden concreta y necesita dos datos para decidir: cuál es y
 * cuántas quedan. El disponible se lee **después** de que la reserva falló,
 * que es cuando hace falta, y no antes de cada intento.
 */
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
          ? `Sólo ${hay === 1 ? "queda 1 unidad" : `quedan ${hay} unidades`} de «${args.nombre}», y hacen falta ${args.quantity}. Si va a entrar mercadería, cargá el stock primero.`
          : `No queda stock de «${args.nombre}». Si va a entrar mercadería, cargá el stock primero.`,
    });
  }
}

/**
 * Subir la cantidad de un renglón que ya está — RF-22 (F7.2a).
 *
 * **La diferencia se reserva, y el precio del renglón no se toca**: las
 * unidades nuevas van al precio que ya tiene esa línea, que es el que el
 * comprador vio y aceptó. Cambiarlo sería cambiar el trato desde el panel.
 *
 * Es la contracara de `reducirCantidad` y vive aparte por lo mismo que aquélla
 * se niega a subir: son dos operaciones con riesgos distintos —una libera y la
 * otra puede fallar— y juntarlas en una sola que mire el signo escondería que
 * una de las dos puede dejar el trabajo a medias.
 */
export async function aumentarCantidad(
  tx: Transaccion,
  args: Contexto & { nuevaCantidad: number },
): Promise<void> {
  exigirCantidad(args.nuevaCantidad, "La cantidad");

  await exigirOrdenActiva(tx, args.orderId);
  const item = await elItem(tx, args);

  if (args.nuevaCantidad < item.quantity) {
    throw domainError("VALIDATION", {
      message: `Esto sólo sube: la orden tiene ${item.quantity}. Para bajar, usá el botón de quitar unidades.`,
    });
  }

  const deMas = args.nuevaCantidad - item.quantity;
  if (deMas === 0) return;

  // Una variante borrada (§5.6) deja el renglón con `variant_id` en NULL: el
  // snapshot se lee igual, pero no hay contador que reservar. Sumar unidades
  // de algo que ya no existe sería comprometer stock inexistente.
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
  /** `true` si la variante ya estaba y se sumó sobre su renglón (RF-22). */
  sumadoAlRenglon: boolean;
  /** Con cuántas unidades quedó ese renglón. */
  cantidad: number;
};

/**
 * Agregar a la orden un producto que no estaba — RF-22 (F7.2a).
 *
 * **Si ya está, suma sobre su renglón** en vez de crear un segundo renglón
 * igual, que es lo mismo que hace el carrito (RF-08): dos líneas del mismo
 * color y el mismo precio son una sola cosa contada dos veces, y para la
 * vendedora que prepara el pedido es una trampa.
 *
 * **Y entonces las unidades van al precio de ESE renglón**, no al del catálogo
 * de hoy: el precio del renglón es el que se acordó para esa línea. Sale solo
 * de delegar en `aumentarCantidad`, que no toca el precio.
 *
 * **Un producto nuevo entra al precio vigente**, con su descuento aplicado
 * (RN-04b), y queda congelado como cualquier otro renglón (RN-12).
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

  // El más viejo si hubiera dos: una orden manual puede haber cargado la
  // misma variante en dos renglones a precios distintos (F7.4), y en ese caso
  // sumar sobre el primero es lo previsible.
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
      LEFT JOIN colors c ON c.id = v.color_id
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
