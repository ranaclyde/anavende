import "server-only";

import { sql } from "drizzle-orm";

import { domainError } from "@/lib/errors";
import {
  reponer,
  revertirReposicion,
  type Transaccion,
} from "@/modules/stock/operaciones";

/**
 * Devoluciones — FS RF-25 · TS §5.7, §8.1. Tarea F4.5.
 *
 * Se registran contra una orden **finalizada**: lo que todavía no se entregó
 * no se devuelve, se edita (RF-22) o se cancela (RF-23).
 *
 * Cada ítem dice si **repone** —producto en condiciones, vuelve al stock— o
 * **no repone** —defectuoso o descartado, se registra y no toca ningún
 * contador—. Que la devolución sin reposición no mueva stock no la vuelve
 * invisible: queda en `returns` para los reportes de RF-28, donde las
 * devoluciones se descuentan de las ventas netas.
 *
 * **Una devolución no se edita: se anula y se vuelve a cargar** (RF-25). Por
 * eso `anularDevolucion` revierte lo que repuso, y por eso lo anulado deja de
 * contar para el tope de «no más de lo vendido».
 *
 * ── Por qué se bloquea la orden ────────────────────────────────────────
 *
 * El tope de RF-25 —nunca más de lo vendido ni de lo ya devuelto— se calcula
 * sumando las devoluciones que ya existen. Dos devoluciones simultáneas sobre
 * el mismo renglón leerían las dos la misma suma, las dos darían que entra, y
 * entre las dos devolverían más de lo que se vendió. El `FOR UPDATE` sobre la
 * orden las pone en fila: es la misma carrera del stock, resuelta en el mismo
 * lugar donde se decide.
 */

export type ItemADevolver = {
  orderItemId: string;
  quantity: number;
  /** `false` = defectuoso: se registra y NO vuelve al stock (RF-25). */
  restocks: boolean;
  reason?: string | null;
};

export type DatosDeDevolucion = {
  orderId: string;
  /** Obligatorio: `returns.reason` es NOT NULL (§5.7). */
  reason: string;
  createdBy?: string | null;
  items: readonly ItemADevolver[];
};

type RenglonVendido = {
  orderItemId: string;
  variantId: string | null;
  vendidas: number;
  productName: string;
  yaDevueltas: number;
};

async function exigirOrdenFinalizada(
  tx: Transaccion,
  orderId: string,
): Promise<void> {
  const [orden] = await tx.execute<{ status: string }>(sql`
    SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`);

  if (!orden) throw domainError("NOT_FOUND");

  if (orden.status !== "finalizada") {
    throw domainError("INVALID_ORDER_STATE", {
      estadoActual: orden.status,
      message:
        "Sólo se registran devoluciones sobre órdenes finalizadas. Una orden " +
        "que todavía no se entregó se edita o se cancela.",
    });
  }
}

/**
 * Lo vendido y lo ya devuelto de cada renglón, en una sola consulta.
 *
 * `r.status = 'registrada'` es lo que hace que anular libere el cupo: una
 * devolución anulada deja de contar contra el tope, que es lo que RF-25 quiere
 * al decir «se anula y se vuelve a cargar».
 */
async function renglones(
  tx: Transaccion,
  orderId: string,
  ids: readonly string[],
): Promise<Map<string, RenglonVendido>> {
  const filas = await tx.execute<RenglonVendido>(sql`
    SELECT oi.id           AS "orderItemId",
           oi.variant_id   AS "variantId",
           oi.quantity     AS "vendidas",
           oi.product_name AS "productName",
           COALESCE((
             SELECT SUM(ri.quantity)::int
               FROM return_items ri
               JOIN returns r ON r.id = ri.return_id
              WHERE ri.order_item_id = oi.id
                AND r.status = 'registrada'
           ), 0) AS "yaDevueltas"
      FROM order_items oi
     WHERE oi.order_id = ${orderId}
       AND oi.id IN ${sql`(${sql.join(
         ids.map((id) => sql`${id}`),
         sql`, `,
       )})`}`);

  return new Map(filas.map((f) => [f.orderItemId, f]));
}

export async function registrarDevolucion(
  tx: Transaccion,
  datos: DatosDeDevolucion,
): Promise<{ returnId: string }> {
  if (datos.items.length === 0) {
    throw domainError("VALIDATION", {
      message: "Elegí al menos un producto para devolver.",
    });
  }

  const ids = datos.items.map((i) => i.orderItemId);
  if (new Set(ids).size !== ids.length) {
    // Dos renglones para el mismo ítem se validarían por separado contra el
    // mismo tope y pasarían los dos. Se pide una línea por producto.
    throw domainError("VALIDATION", {
      message: "Hay un producto repetido. Poné una sola línea por producto.",
    });
  }

  for (const item of datos.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw domainError("VALIDATION", {
        message: "La cantidad a devolver tiene que ser de uno para arriba.",
      });
    }
  }

  await exigirOrdenFinalizada(tx, datos.orderId);

  const vendidos = await renglones(tx, datos.orderId, ids);

  for (const item of datos.items) {
    const renglon = vendidos.get(item.orderItemId);
    // No está en la orden, o es de otra: sin el `order_id` en la consulta de
    // arriba se podría devolver contra la orden de cualquiera.
    if (!renglon) throw domainError("NOT_FOUND");

    const disponibleParaDevolver = renglon.vendidas - renglon.yaDevueltas;

    if (item.quantity > disponibleParaDevolver) {
      throw domainError("RETURN_EXCEEDS_SOLD", {
        orderItemId: item.orderItemId,
        vendidas: renglon.vendidas,
        yaDevueltas: renglon.yaDevueltas,
        message:
          renglon.yaDevueltas > 0
            ? `De «${renglon.productName}» se vendieron ${renglon.vendidas} y ya se devolvieron ${renglon.yaDevueltas}: quedan ${disponibleParaDevolver} por devolver.`
            : `De «${renglon.productName}» se vendieron ${renglon.vendidas}: no se puede devolver más que eso.`,
      });
    }
  }

  const [devolucion] = await tx.execute<{ id: string }>(sql`
    INSERT INTO returns (order_id, reason, created_by)
    VALUES (${datos.orderId}, ${datos.reason}, ${datos.createdBy ?? null})
    RETURNING id`);

  // Ordenado por variante (§8.3 regla 2): dos devoluciones que tocan las
  // mismas variantes en distinto orden se trabarían mutuamente.
  const enOrden = [...datos.items].sort((a, b) =>
    (vendidos.get(a.orderItemId)?.variantId ?? "").localeCompare(
      vendidos.get(b.orderItemId)?.variantId ?? "",
    ),
  );

  for (const item of enOrden) {
    const renglon = vendidos.get(item.orderItemId)!;

    await tx.execute(sql`
      INSERT INTO return_items
        (return_id, order_item_id, quantity, restocks, reason)
      VALUES
        (${devolucion.id}, ${item.orderItemId}, ${item.quantity},
         ${item.restocks}, ${item.reason ?? null})`);

    // Sin reposición no hay movimiento de stock, y eso es lo correcto: el
    // producto volvió roto y no hay nada que vender (§8.1).
    if (item.restocks && renglon.variantId) {
      await reponer(tx, {
        variantId: renglon.variantId,
        quantity: item.quantity,
        returnId: devolucion.id,
        actorUserId: datos.createdBy,
        note: "Devolución con reposición",
      });
    }
  }

  return { returnId: devolucion.id };
}

// ── Anular (RF-25) ──────────────────────────────────────────────────────

/**
 * Revierte el efecto en stock y libera el cupo: lo anulado deja de contar
 * contra el tope de «no más de lo vendido», así que la devolución se puede
 * volver a cargar bien.
 *
 * Sólo lo que había repuesto se revierte. Lo defectuoso nunca entró al stock,
 * así que no hay nada que sacar.
 */
export async function anularDevolucion(
  tx: Transaccion,
  args: { returnId: string; voidReason: string; actorUserId?: string | null },
): Promise<void> {
  // Condicional, como toda transición: dos anulaciones simultáneas dan una
  // ganadora, y la perdedora no llega a revertir el stock por segunda vez.
  const filas = await tx.execute<{ id: string }>(sql`
    UPDATE returns
       SET status = 'anulada',
           void_reason = ${args.voidReason},
           voided_at = now()
     WHERE id = ${args.returnId}
       AND status = 'registrada'
    RETURNING id`);

  if (filas.length === 0) {
    const [actual] = await tx.execute<{ status: string }>(sql`
      SELECT status FROM returns WHERE id = ${args.returnId}`);

    if (!actual) throw domainError("NOT_FOUND");

    throw domainError("INVALID_ORDER_STATE", {
      estadoActual: actual.status,
      message: "Esa devolución ya está anulada. Actualizá la página.",
    });
  }

  const repuestos = await tx.execute<{
    variantId: string | null;
    quantity: number;
  }>(sql`
    SELECT oi.variant_id AS "variantId", ri.quantity
      FROM return_items ri
      JOIN order_items oi ON oi.id = ri.order_item_id
     WHERE ri.return_id = ${args.returnId}
       AND ri.restocks
     ORDER BY oi.variant_id`);

  for (const item of repuestos) {
    if (!item.variantId) continue;

    await revertirReposicion(tx, {
      variantId: item.variantId,
      quantity: item.quantity,
      returnId: args.returnId,
      actorUserId: args.actorUserId,
      note: "Devolución anulada",
    });
  }
}
