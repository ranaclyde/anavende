import "server-only";

import { sql } from "drizzle-orm";

import type { db } from "@/db";
import { domainError } from "@/lib/errors";

// Las operaciones de stock de TECHNICAL-SPEC §8. Nada fuera de este archivo
// escribe `stock_total` ni `reserved_stock`: el ABM de variantes llama a `ajustar()`.

/** El `tx` de `db.transaction`. */
export type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Contadores = { stockTotal: number; reservedStock: number };

type Rastro = {
  variantId: string;
  /** NULL cuando lo dispara el comprador y no la vendedora. */
  actorUserId?: string | null;
  orderId?: string | null;
  returnId?: string | null;
  note?: string | null;
};

type Movimiento = "ajuste" | "reserva" | "liberacion" | "venta" | "devolucion";

/**
 * Los paréntesis alrededor de `donde` no son de estilo: `AND` precede a `OR`,
 * y sin ellos una condición con `OR` deja de filtrar por `id` y toca otras variantes.
 */
async function mover(
  tx: Transaccion,
  rastro: Rastro,
  movimiento: {
    set: ReturnType<typeof sql>;
    donde: ReturnType<typeof sql>;
    type: Movimiento;
    /** Ya con signo, tal como se asienta. */
    quantity: number;
    /** Se llama si el `UPDATE` no toca filas y la variante existe. */
    siNoAplica: () => never;
  },
): Promise<Contadores> {
  const filas = await tx.execute<Contadores>(sql`
    UPDATE product_variants
       SET ${movimiento.set},
           updated_at = now()
     WHERE id = ${rastro.variantId}
       AND (${movimiento.donde})
    RETURNING stock_total AS "stockTotal",
              reserved_stock AS "reservedStock"`);

  const despues = filas[0];

  if (!despues) {
    const existe = await tx.execute<{ uno: number }>(sql`
      SELECT 1 AS uno FROM product_variants WHERE id = ${rastro.variantId}`);
    if (existe.length === 0) throw domainError("NOT_FOUND");
    movimiento.siNoAplica();
  }

  await tx.execute(sql`
    INSERT INTO stock_movements
      (variant_id, type, quantity, stock_after, reserved_after,
       order_id, return_id, actor_user_id, note)
    VALUES
      (${rastro.variantId}, ${movimiento.type}, ${movimiento.quantity},
       ${despues.stockTotal}, ${despues.reservedStock},
       ${rastro.orderId ?? null}, ${rastro.returnId ?? null},
       ${rastro.actorUserId ?? null}, ${rastro.note ?? null})`);

  return despues;
}

function exigirCantidad(cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new TypeError(
      `La cantidad tiene que ser un entero positivo, llegó ${cantidad}.`,
    );
  }
}

export async function reservar(
  tx: Transaccion,
  args: Rastro & { quantity: number },
): Promise<Contadores> {
  exigirCantidad(args.quantity);
  return mover(tx, args, {
    set: sql`reserved_stock = reserved_stock + ${args.quantity}`,
    donde: sql`stock_total - reserved_stock >= ${args.quantity}`,
    type: "reserva",
    quantity: args.quantity,
    siNoAplica: () => {
      throw domainError("INSUFFICIENT_STOCK", { variantId: args.variantId });
    },
  });
}

/**
 * Si no hay tanto reservado, quien llamó se desincronizó: es un bug, no un
 * resultado del negocio. Por eso `Error` y no `DomainError`, para que llegue a Sentry.
 */
export async function liberar(
  tx: Transaccion,
  args: Rastro & { quantity: number },
): Promise<Contadores> {
  exigirCantidad(args.quantity);
  return mover(tx, args, {
    set: sql`reserved_stock = reserved_stock - ${args.quantity}`,
    donde: sql`reserved_stock >= ${args.quantity}`,
    type: "liberacion",
    quantity: -args.quantity,
    siNoAplica: () => {
      throw new Error(
        `Se intentó liberar ${args.quantity} de la variante ${args.variantId}, ` +
          "que no tiene tanto reservado. La reserva y la orden se desincronizaron.",
      );
    },
  });
}

/**
 * Con `desdeReserva: false` (orden manual cargada como finalizada, RF-24) el
 * total puede quedar negativo, y no es un error: TECHNICAL-SPEC §5.4.
 */
export async function vender(
  tx: Transaccion,
  args: Rastro & { quantity: number; desdeReserva?: boolean },
): Promise<Contadores> {
  exigirCantidad(args.quantity);
  const desdeReserva = args.desdeReserva ?? true;

  return mover(tx, args, {
    set: desdeReserva
      ? sql`stock_total = stock_total - ${args.quantity},
            reserved_stock = reserved_stock - ${args.quantity}`
      : sql`stock_total = stock_total - ${args.quantity}`,
    donde: desdeReserva
      ? sql`reserved_stock >= ${args.quantity}`
      : // La guarda del CHECK `reserved_within_total`, repetida en el WHERE para
        // que salga como INSUFFICIENT_STOCK y no como error de integridad en Sentry.
        sql`stock_total - ${args.quantity} < 0
            OR reserved_stock <= stock_total - ${args.quantity}`,
    type: "venta",
    quantity: -args.quantity,
    siNoAplica: () => {
      if (desdeReserva) {
        throw new Error(
          `Se intentó vender ${args.quantity} de la variante ${args.variantId} ` +
            "sin que estuvieran reservadas. La orden y el stock se desincronizaron.",
        );
      }
      throw domainError("INSUFFICIENT_STOCK", {
        variantId: args.variantId,
        message:
          "Esa cantidad dejaría el stock por debajo de lo que ya está " +
          "reservado en órdenes activas. Resolvé esas órdenes primero.",
      });
    },
  });
}

export async function reponer(
  tx: Transaccion,
  args: Rastro & { quantity: number },
): Promise<Contadores> {
  exigirCantidad(args.quantity);
  return mover(tx, args, {
    set: sql`stock_total = stock_total + ${args.quantity}`,
    // Sin condición a propósito: subir el total no puede romper ningún CHECK.
    donde: sql`true`,
    type: "devolucion",
    quantity: args.quantity,
    siNoAplica: () => {
      // Inalcanzable: con `true`, cero filas solo es una variante que no existe.
      throw new Error("reponer(): el UPDATE no encontró la fila.");
    },
  });
}

/** La inversa de `reponer`, para anular una devolución (TECHNICAL-SPEC §8.1). */
export async function revertirReposicion(
  tx: Transaccion,
  args: Rastro & { quantity: number },
): Promise<Contadores> {
  exigirCantidad(args.quantity);
  return mover(tx, args, {
    set: sql`stock_total = stock_total - ${args.quantity}`,
    // La misma guarda que `vender` sin reserva: el total puede quedar negativo
    // si mientras tanto se vendió lo que había vuelto.
    donde: sql`stock_total - ${args.quantity} < 0
               OR reserved_stock <= stock_total - ${args.quantity}`,
    type: "devolucion",
    quantity: -args.quantity,
    siNoAplica: () => {
      throw domainError("INSUFFICIENT_STOCK", {
        variantId: args.variantId,
        message:
          "Anular esa devolución dejaría el stock por debajo de lo que ya " +
          "está reservado en órdenes activas. Resolvé esas órdenes primero.",
      });
    },
  });
}

/**
 * Asigna el total, no lo suma. Es la única con `SELECT … FOR UPDATE`: el
 * asiento lleva la diferencia, y el valor anterior no se puede mover entre la
 * lectura y la escritura (TECHNICAL-SPEC §8.3).
 */
export async function ajustar(
  tx: Transaccion,
  args: Rastro & { nuevoTotal: number },
): Promise<Contadores> {
  if (!Number.isInteger(args.nuevoTotal) || args.nuevoTotal < 0) {
    throw new TypeError(
      `El stock ajustado tiene que ser un entero de cero para arriba, llegó ${args.nuevoTotal}.`,
    );
  }

  const [antes] = await tx.execute<Contadores>(sql`
    SELECT stock_total AS "stockTotal", reserved_stock AS "reservedStock"
      FROM product_variants
     WHERE id = ${args.variantId}
       FOR UPDATE`);

  if (!antes) throw domainError("NOT_FOUND");

  if (antes.reservedStock > args.nuevoTotal) {
    // El CHECK `reserved_within_total` lo rechazaría como error de integridad,
    // que llega a Sentry como incidente; es un resultado del negocio.
    const n = antes.reservedStock;
    throw domainError("INSUFFICIENT_STOCK", {
      variantId: args.variantId,
      reservedStock: n,
      message: `Hay ${n} ${n === 1 ? "unidad reservada" : "unidades reservadas"} en órdenes activas, así que el stock no puede bajar de ${n}.`,
    });
  }

  const diferencia = args.nuevoTotal - antes.stockTotal;

  // Sin diferencia no hay asiento, pero `updated_at` se toca igual: la vendedora guardó.
  await tx.execute(sql`
    UPDATE product_variants
       SET stock_total = ${args.nuevoTotal},
           updated_at = now()
     WHERE id = ${args.variantId}`);

  if (diferencia !== 0) {
    await tx.execute(sql`
      INSERT INTO stock_movements
        (variant_id, type, quantity, stock_after, reserved_after,
         order_id, return_id, actor_user_id, note)
      VALUES
        (${args.variantId}, 'ajuste', ${diferencia},
         ${args.nuevoTotal}, ${antes.reservedStock},
         ${args.orderId ?? null}, ${args.returnId ?? null},
         ${args.actorUserId ?? null}, ${args.note ?? null})`);
  }

  return { stockTotal: args.nuevoTotal, reservedStock: antes.reservedStock };
}
