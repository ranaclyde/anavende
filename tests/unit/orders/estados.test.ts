import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { DomainError } from "@/lib/errors";
import {
  TRANSICIONES,
  cancelarOrden,
  finalizarOrden,
  transicionPermitida,
} from "@/modules/orders/estados";
import {
  contadores,
  limpiar,
  movimientos,
  unaVariante,
} from "@/tests/apoyo/catalogo";
import { dosALaVez } from "@/tests/apoyo/concurrencia";
import {
  estadoDeLaOrden,
  historial,
  limpiarOrdenes,
  unaOrdenActiva,
  unaOrdenDeUnItem,
} from "@/tests/apoyo/ordenes";

/**
 * F4.2 — la máquina de estados de la orden. RF-13, RF-23 · §5.6.
 *
 * El «Hecho cuando» son tres cosas: que las transiciones válidas funcionen,
 * que las inválidas se rechacen con `INVALID_ORDER_STATE`, y que cada una
 * escriba en el historial. La cuarta, que no está escrita pero es la que
 * importa, es que dos transiciones simultáneas no descuenten el stock dos
 * veces.
 */

afterEach(async () => {
  await limpiarOrdenes();
  await limpiar();
});

function enTransaccion<T>(
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}

describe("la tabla de RF-13", () => {
  test("desde activa se sale para los dos lados", () => {
    expect(transicionPermitida("activa", "finalizada")).toBe(true);
    expect(transicionPermitida("activa", "cancelada")).toBe(true);
  });

  test("finalizada y cancelada no van a ningún lado", () => {
    expect(TRANSICIONES.finalizada).toEqual([]);
    expect(TRANSICIONES.cancelada).toEqual([]);
    expect(transicionPermitida("finalizada", "cancelada")).toBe(false);
    expect(transicionPermitida("cancelada", "finalizada")).toBe(false);
    expect(transicionPermitida("finalizada", "activa")).toBe(false);
  });
});

describe("finalizar", () => {
  test("descuenta el stock real, suelta la reserva y deja fecha", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 10,
      cantidad: 3,
    });

    await enTransaccion((tx) =>
      finalizarOrden(tx, { orderId, reason: "Entregada en mano" }),
    );

    const orden = await estadoDeLaOrden(orderId);
    expect(orden.status).toBe("finalizada");
    expect(orden.finalizedAt).not.toBeNull();
    expect(orden.cancelledAt).toBeNull();

    // 10 − 3 de total, y la reserva de esas 3 se soltó en el mismo paso.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 7,
      reservedStock: 0,
    });

    const libro = await movimientos(variantId);
    expect(libro).toMatchObject([
      { type: "venta", quantity: -3, stockAfter: 7, reservedAfter: 0 },
    ]);
    // El asiento tiene que poder decir de qué orden salió.
    expect(libro[0].orderId).toBe(orderId);
  });

  test("escribe en el historial con el motivo y de dónde venía", async () => {
    const { orderId } = await unaOrdenDeUnItem({ total: 5, cantidad: 1 });

    await enTransaccion((tx) =>
      finalizarOrden(tx, { orderId, reason: "Pagó por transferencia" }),
    );

    expect(await historial(orderId)).toMatchObject([
      { fromStatus: null, toStatus: "activa" },
      {
        fromStatus: "activa",
        toStatus: "finalizada",
        reason: "Pagó por transferencia",
      },
    ]);
  });

  test("varios ítems se descuentan todos", async () => {
    const a = await unaVariante({ total: 10, reservado: 2 });
    const b = await unaVariante({ total: 4, reservado: 4 });
    const { orderId } = await unaOrdenActiva([
      { variantId: a.variantId, quantity: 2 },
      { variantId: b.variantId, quantity: 4 },
    ]);

    await enTransaccion((tx) => finalizarOrden(tx, { orderId }));

    expect(await contadores(a.variantId)).toEqual({
      stockTotal: 8,
      reservedStock: 0,
    });
    expect(await contadores(b.variantId)).toEqual({
      stockTotal: 0,
      reservedStock: 0,
    });
  });

  test("un ítem cuya variante ya no existe no rompe la finalización", async () => {
    // `order_items.variant_id` es ON DELETE SET NULL (§5.6): el snapshot de la
    // orden se lee igual, pero ya no hay contador que mover. Que eso reviente
    // dejaría la orden trabada para siempre.
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 6,
      cantidad: 2,
    });
    await db.execute(sql`
      UPDATE order_items SET variant_id = NULL WHERE order_id = ${orderId}`);

    await enTransaccion((tx) => finalizarOrden(tx, { orderId }));

    expect((await estadoDeLaOrden(orderId)).status).toBe("finalizada");
    // La variante quedó como estaba: nadie la tocó, y así tiene que ser.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 2,
    });
  });
});

describe("cancelar", () => {
  test("suelta la reserva sin tocar el stock real", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 10,
      cantidad: 3,
    });

    await enTransaccion((tx) =>
      cancelarOrden(tx, { orderId, reason: "El comprador se arrepintió" }),
    );

    const orden = await estadoDeLaOrden(orderId);
    expect(orden.status).toBe("cancelada");
    expect(orden.cancelledAt).not.toBeNull();
    expect(orden.finalizedAt).toBeNull();

    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
    expect(await movimientos(variantId)).toMatchObject([
      { type: "liberacion", quantity: -3, stockAfter: 10, reservedAfter: 0 },
    ]);
  });

  test("lo liberado vuelve a estar disponible para otro", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 1,
      cantidad: 1,
    });

    await enTransaccion((tx) => cancelarOrden(tx, { orderId }));

    // La única unidad estaba comprometida y ahora no lo está. Es el punto
    // entero de cancelar.
    const { stockTotal, reservedStock } = await contadores(variantId);
    expect(stockTotal - reservedStock).toBe(1);
  });
});

describe("las transiciones que no existen", () => {
  test("finalizar dos veces: la segunda es INVALID_ORDER_STATE", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 10,
      cantidad: 3,
    });

    await enTransaccion((tx) => finalizarOrden(tx, { orderId }));

    const fallo = (await enTransaccion((tx) =>
      finalizarOrden(tx, { orderId }),
    ).catch((e: unknown) => e)) as DomainError;

    expect(fallo).toBeInstanceOf(DomainError);
    expect(fallo.code).toBe("INVALID_ORDER_STATE");
    expect(fallo.details).toMatchObject({ estadoActual: "finalizada" });

    // Y sobre todo: el stock se descontó UNA vez.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 7,
      reservedStock: 0,
    });
    expect(await movimientos(variantId)).toHaveLength(1);
  });

  test("cancelar una finalizada no se puede", async () => {
    const { orderId } = await unaOrdenDeUnItem({ total: 5, cantidad: 1 });
    await enTransaccion((tx) => finalizarOrden(tx, { orderId }));

    await expect(
      enTransaccion((tx) => cancelarOrden(tx, { orderId })),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_STATE" });
  });

  test("finalizar una cancelada tampoco", async () => {
    const { orderId } = await unaOrdenDeUnItem({ total: 5, cantidad: 1 });
    await enTransaccion((tx) => cancelarOrden(tx, { orderId }));

    await expect(
      enTransaccion((tx) => finalizarOrden(tx, { orderId })),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_STATE" });
  });

  test("una orden inexistente es NOT_FOUND, no un estado inválido", async () => {
    await expect(
      enTransaccion((tx) =>
        finalizarOrden(tx, {
          orderId: "00000000-0000-0000-0000-000000000000",
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("el rechazo no deja nada escrito", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 5,
      cantidad: 2,
    });
    await enTransaccion((tx) => cancelarOrden(tx, { orderId }));

    const antes = await historial(orderId);
    await enTransaccion((tx) => finalizarOrden(tx, { orderId })).catch(
      () => undefined,
    );

    expect(await historial(orderId)).toEqual(antes);
    expect(await contadores(variantId)).toEqual({
      stockTotal: 5,
      reservedStock: 0,
    });
  });
});

describe("dos administradoras al mismo tiempo", () => {
  test("dos «Finalizar» simultáneos descuentan el stock UNA vez", async () => {
    // Es el mismo peligro que la Compuerta F4 pero del lado de la orden: con
    // un SELECT para chequear el estado y un UPDATE después, las dos
    // transacciones pasarían el chequeo y venderían las mismas unidades.
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 10,
      cantidad: 4,
    });

    // Solapadas de verdad: la segunda llega al UPDATE mientras la primera
    // todavía no commiteó, y se queda esperando el bloqueo de la fila.
    const resultados = await dosALaVez(
      (tx) => finalizarOrden(tx, { orderId }),
      (tx) => finalizarOrden(tx, { orderId }),
    );

    const cumplidas = resultados.filter((r) => r.status === "fulfilled");
    const rechazadas = resultados.filter((r) => r.status === "rejected");

    expect(cumplidas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0].reason).toMatchObject({
      code: "INVALID_ORDER_STATE",
    });

    expect(await contadores(variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });
    expect(await movimientos(variantId)).toHaveLength(1);
    expect(await historial(orderId)).toHaveLength(2);
  });

  test("finalizar y cancelar a la vez: gana uno solo", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 8,
      cantidad: 3,
    });

    const resultados = await dosALaVez(
      (tx) => finalizarOrden(tx, { orderId }),
      (tx) => cancelarOrden(tx, { orderId }),
    );

    // La que llegó primero gana; la otra se despierta y ve una orden que ya
    // no está activa.
    expect(resultados[0].status).toBe("fulfilled");
    expect(resultados[1]).toMatchObject({
      status: "rejected",
      reason: { code: "INVALID_ORDER_STATE" },
    });

    // Y hay UN solo movimiento: la venta. Lo que no puede pasar es que se
    // descuente y además se libere, que sería devolver al stock algo que ya
    // se vendió.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 5,
      reservedStock: 0,
    });
    expect(await movimientos(variantId)).toMatchObject([{ type: "venta" }]);
  });
});

test("si algo se cae después de la transición, se cae todo junto", async () => {
  const { orderId, variantId } = await unaOrdenDeUnItem({
    total: 10,
    cantidad: 2,
  });

  await expect(
    enTransaccion(async (tx) => {
      await finalizarOrden(tx, { orderId });
      throw new Error("el email de aviso reventó");
    }),
  ).rejects.toThrow("el email de aviso reventó");

  expect((await estadoDeLaOrden(orderId)).status).toBe("activa");
  expect(await contadores(variantId)).toEqual({
    stockTotal: 10,
    reservedStock: 2,
  });
  expect(await historial(orderId)).toHaveLength(1);
});
