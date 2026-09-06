import "server-only";

import { sql } from "drizzle-orm";

import type { db } from "@/db";
import { domainError } from "@/lib/errors";

/**
 * Las cinco operaciones de stock — TECHNICAL-SPEC §8.1, §8.2, §8.3. Tarea F4.1.
 *
 * Es la parte del sistema donde un error no se nota hasta que ya vendiste dos
 * veces la misma unidad (R1). Tres decisiones sostienen todo lo demás:
 *
 * **1. Un solo `UPDATE` condicional, nunca leer-y-después-escribir.** La
 * condición del `WHERE` *es* la regla de negocio. El `UPDATE` toma el bloqueo
 * de fila y evalúa la condición en el mismo paso atómico, así que no hay
 * ventana entre mirar el stock y cambiarlo. Dos compradores confirmando la
 * última unidad al mismo tiempo dan un ganador y un `INSUFFICIENT_STOCK`
 * limpio (§8.2). Con `SELECT` + `UPDATE` darían dos ganadores, y el segundo
 * se descubre cuando hay que llamar a alguien a pedirle disculpas.
 *
 * **2. El estado posterior sale del `RETURNING`, no de una segunda consulta.**
 * `stock_after` y `reserved_after` del libro mayor tienen que ser los valores
 * que dejó *esta* sentencia. Releerlos después sería releer un número que otra
 * transacción ya pudo haber movido, y el libro quedaría contando una historia
 * que no pasó.
 *
 * **3. Nadie toca los contadores sin pasar por acá.** Ni siquiera el ABM de
 * variantes, que ajusta stock desde el panel: llama a `ajustar()`. Un segundo
 * lugar que escriba `stock_total` es un segundo lugar que puede olvidarse del
 * asiento (§8.3, regla 3).
 *
 * ── El signo de `quantity` en el libro mayor ────────────────────────────
 *
 * §5.8 pide «con signo, según el efecto» sin decir sobre cuál de los dos
 * contadores. La regla que se adoptó, y que los tests verifican:
 *
 *   · `ajuste`, `venta`, `devolucion` → el efecto sobre **`stock_total`**
 *   · `reserva`, `liberacion`         → el efecto sobre **`reserved_stock`**
 *
 * Que es lo mismo que decir: cada movimiento firma el contador que mueve, y
 * los dos que mueven el total no son los mismos que mueven la reserva. De ahí
 * sale el invariante que se puede comprobar de una consulta:
 *
 *     stock_total = SUM(quantity) WHERE type IN ('ajuste','venta','devolucion')
 *
 * Y vale también para la venta que nunca estuvo reservada (RF-24, una orden
 * manual cargada como finalizada), que es el caso donde una regla más
 * ingeniosa se habría roto.
 *
 * La reserva no se deriva de una suma parecida a propósito: `venta` consume la
 * reserva sin escribir una `liberacion`, así que la cuenta no cerraría. Para
 * ese lado el libro se cuadra contra `reserved_after` del último movimiento,
 * que además detecta cualquier cambio que se haya hecho SIN asentar.
 */

/** El `tx` de `db.transaction`. Todas las operaciones exigen uno: §8.3 regla 1. */
export type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Contadores = { stockTotal: number; reservedStock: number };

/** Lo que toda operación necesita saber para dejar su rastro (§5.8). */
type Rastro = {
  variantId: string;
  /** Quién lo hizo. NULL cuando lo dispara el comprador y no la vendedora. */
  actorUserId?: string | null;
  orderId?: string | null;
  returnId?: string | null;
  note?: string | null;
};

type Movimiento = "ajuste" | "reserva" | "liberacion" | "venta" | "devolucion";

/**
 * El `UPDATE` condicional, el `RETURNING` y el asiento, en ese orden y sin
 * nada en el medio. Las cinco operaciones son esta función con otro `SET` y
 * otro `WHERE`.
 */
async function mover(
  tx: Transaccion,
  rastro: Rastro,
  movimiento: {
    set: ReturnType<typeof sql>;
    donde: ReturnType<typeof sql>;
    type: Movimiento;
    /** Ya con signo: es lo que se guarda tal cual. */
    quantity: number;
    /** Qué contar si el `UPDATE` no encuentra fila. */
    siNoAplica: () => never;
  },
): Promise<Contadores> {
  const filas = await tx.execute<Contadores>(sql`
    UPDATE product_variants
       SET ${movimiento.set},
           updated_at = now()
     WHERE id = ${rastro.variantId}
       AND ${movimiento.donde}
    RETURNING stock_total AS "stockTotal",
              reserved_stock AS "reservedStock"`);

  const despues = filas[0];

  if (!despues) {
    // Cero filas dice «no se pudo», no dice por qué. Una variante que no
    // existe y una sin stock son dos respuestas distintas para quien las
    // recibe (RNF-08), así que se separan acá y no en la vista.
    const existe = await tx.execute<{ uno: number }>(sql`
      SELECT 1 AS uno FROM product_variants WHERE id = ${rastro.variantId}`);
    if (existe.length === 0) throw domainError("NOT_FOUND");
    movimiento.siNoAplica();
  }

  // EN LA MISMA TRANSACCIÓN, sin excepción (§8.3 regla 3). Si el asiento no
  // se puede escribir, el cambio de stock tampoco ocurre.
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

/** Las cantidades son unidades: enteras y positivas, siempre. */
function exigirCantidad(cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new TypeError(
      `La cantidad tiene que ser un entero positivo, llegó ${cantidad}.`,
    );
  }
}

// ── Reservar (RF-12: la orden pasa a activa) ────────────────────────────

/**
 * `reserved_stock += q`, sólo si hay disponible. Es el `UPDATE` textual de
 * §8.2 y el que decide quién se queda con la última unidad.
 */
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

// ── Liberar (RF-22, RF-23: orden cancelada o ítem quitado) ──────────────

/**
 * `reserved_stock -= q`. La condición existe para que la reserva no se vaya
 * abajo de cero, que es el estado desde el cual ya nada vuelve a cuadrar.
 *
 * Que no dé la cuenta NO es un resultado del negocio: significa que quien
 * llamó cree que hay una reserva que no está. Por eso revienta como error y
 * no como `DomainError` — tiene que llegar a Sentry y arreglarse, no
 * mostrarse en pantalla.
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

// ── Vender (RF-23: finalizar la orden) ──────────────────────────────────

/**
 * `stock_total -= q` y, si venía de una reserva, `reserved_stock -= q`.
 *
 * `desdeReserva: false` es el caso de RF-24: una orden manual cargada
 * directamente como finalizada registra una venta que ya ocurrió y nunca pasó
 * por una reserva. Ahí **el total puede quedar negativo**, y eso no es un
 * error: §5.4 decidió no ponerle CHECK justamente para no obligar a la
 * vendedora a mentirle al sistema. Un total negativo es una señal de
 * discrepancia, se destaca en el panel y se corrige con un ajuste.
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
      : // Sin reserva que consumir, la guarda es la del CHECK
        // `reserved_within_total`: el total puede irse abajo de cero, pero no
        // puede quedar por encima de cero y por debajo de lo comprometido.
        // Se pone en el WHERE para que salga como resultado del negocio y no
        // como una violación de integridad que Sentry cuenta como incidente.
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

// ── Reponer (RF-25: devolución con reposición) ──────────────────────────

/**
 * `stock_total += q`. Sin condición, y no es un olvido: subir el total no
 * puede romper ninguno de los dos CHECK de la tabla.
 *
 * La devolución SIN reposición no llama a esta función ni a ninguna otra: no
 * tiene efecto sobre el stock (§8.1). Se registra en `returns` y se termina.
 */
export async function reponer(
  tx: Transaccion,
  args: Rastro & { quantity: number },
): Promise<Contadores> {
  exigirCantidad(args.quantity);
  return mover(tx, args, {
    set: sql`stock_total = stock_total + ${args.quantity}`,
    donde: sql`true`,
    type: "devolucion",
    quantity: args.quantity,
    siNoAplica: () => {
      // Inalcanzable: la condición es `true`, así que cero filas sólo puede
      // significar que la variante no existe, y eso ya se resolvió arriba.
      throw new Error("reponer(): el UPDATE no encontró la fila.");
    },
  });
}

// ── Ajustar (RF-16: la vendedora corrige el número) ─────────────────────

/**
 * `stock_total = nuevoTotal`. Es una asignación, no una suma: la vendedora
 * cuenta lo que hay en la caja y escribe ese número.
 *
 * **La única que usa `SELECT … FOR UPDATE`, y a propósito.** §8.2 descarta ese
 * patrón para la reserva, que es el camino caliente y donde la condición ES la
 * regla de negocio. Acá el caso es otro: el asiento del libro tiene que llevar
 * la DIFERENCIA —`nuevoTotal` menos lo que había—, así que hay que conocer el
 * valor anterior, y un `UPDATE` a secas no lo devuelve. Leerlo antes sin
 * bloquear deja una ventana en la que otra transacción lo mueve, y el libro
 * queda descuadrado por exactamente lo que pasó en el medio. El `FOR UPDATE`
 * cierra esa ventana: nadie toca la fila hasta que esta transacción termina.
 *
 * Se puede pagar ese bloqueo porque esto lo dispara la vendedora desde el
 * panel, de a una variante por vez, y no dos compradores a la vez.
 */
export async function ajustar(
  tx: Transaccion,
  args: Rastro & { nuevoTotal: number },
): Promise<Contadores> {
  if (!Number.isInteger(args.nuevoTotal) || args.nuevoTotal < 0) {
    // RF-16: el stock que se escribe A MANO no admite negativos. Que la
    // columna acepte un total negativo (RF-24) es otra cosa: ahí el negativo
    // lo produce una venta ya ocurrida. Escribir «−3» en el formulario no
    // registra ninguna discrepancia, es un error de tipeo.
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
    // El CHECK `reserved_within_total` rechazaría esto con un error de
    // integridad, que sale como INTERNAL y llega a Sentry como si fuera un
    // incidente. Es un resultado del negocio y merece la frase que lo explica.
    const n = antes.reservedStock;
    throw domainError("INSUFFICIENT_STOCK", {
      variantId: args.variantId,
      reservedStock: n,
      message: `Hay ${n} ${n === 1 ? "unidad reservada" : "unidades reservadas"} en órdenes activas, así que el stock no puede bajar de ${n}.`,
    });
  }

  const diferencia = args.nuevoTotal - antes.stockTotal;

  // Un ajuste que no cambia nada no es un movimiento: asentarlo llenaría el
  // libro de filas en cero cada vez que alguien guarda el formulario sin
  // haber tocado el stock. Igual se actualiza `updated_at`: la vendedora
  // guardó, y eso pasó.
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
