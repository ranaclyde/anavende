import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { quitarItem, reducirCantidad } from "@/modules/orders/editar";
import { finalizarOrden } from "@/modules/orders/estados";
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
  renglonesDeLaOrden,
  totalDeLaOrden,
  unaOrdenActiva,
  unaOrdenDeUnItem,
} from "@/tests/apoyo/ordenes";

/**
 * F4.4 — edición de una orden activa. RF-22 · §8.1.
 *
 * «Hecho cuando»: libera la reserva y recalcula el total; quitar el último
 * ítem equivale a cancelar.
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

/** Una orden de dos renglones, con las dos reservas puestas. */
async function ordenDeDos() {
  const a = await unaVariante({ total: 10, reservado: 2 });
  const b = await unaVariante({ total: 10, reservado: 5 });
  const { orderId } = await unaOrdenActiva([
    { variantId: a.variantId, quantity: 2, unitPrice: "1500.00" },
    { variantId: b.variantId, quantity: 5, unitPrice: "200.00" },
  ]);
  // El total lo pone quien crea la orden; el andamiaje no pasa por §8.4.
  await db.execute(sql`
    UPDATE orders SET total = '4000.00' WHERE id = ${orderId}`);
  const renglones = await renglonesDeLaOrden(orderId);
  return { orderId, a, b, renglones };
}

describe("quitar un ítem", () => {
  test("libera la reserva, recalcula el total y lo anota", async () => {
    const { orderId, a, b, renglones } = await ordenDeDos();

    const resultado = await enTransaccion((tx) =>
      quitarItem(tx, { orderId, orderItemId: renglones[0].id }),
    );

    expect(resultado.ordenCancelada).toBe(false);
    expect((await estadoDeLaOrden(orderId)).status).toBe("activa");

    // Las dos unidades vuelven a estar disponibles de inmediato: es el punto
    // entero de RF-22.
    expect(await contadores(a.variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
    expect(await movimientos(a.variantId)).toMatchObject([
      { type: "liberacion", quantity: -2 },
    ]);

    // El otro renglón queda intacto.
    expect(await contadores(b.variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 5,
    });
    expect(await renglonesDeLaOrden(orderId)).toHaveLength(1);

    // 5 × 200.00, sumado en SQL sobre lo que quedó.
    expect(await totalDeLaOrden(orderId)).toBe("1000.00");

    expect(await historial(orderId)).toMatchObject([
      { fromStatus: null, toStatus: "activa" },
      { fromStatus: "activa", toStatus: "activa" },
    ]);
  });

  test("el motivo del historial dice qué producto se quitó", async () => {
    const { orderId, renglones } = await ordenDeDos();

    await enTransaccion((tx) =>
      quitarItem(tx, { orderId, orderItemId: renglones[0].id }),
    );

    const [, edicion] = await historial(orderId);
    expect(edicion.reason).toContain("Producto de prueba");
  });
});

describe("quitar el último ítem", () => {
  test("sin confirmar, no hace nada y avisa que cancelaría", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 10,
      cantidad: 3,
    });
    const [renglon] = await renglonesDeLaOrden(orderId);

    const fallo = (await enTransaccion((tx) =>
      quitarItem(tx, { orderId, orderItemId: renglon.id }),
    ).catch((e: unknown) => e)) as { code: string; details?: Record<string, unknown> };

    expect(fallo.code).toBe("VALIDATION");
    // La pantalla necesita saber POR QUÉ se negó para poder preguntar.
    expect(fallo.details).toMatchObject({ cancelaLaOrden: true });

    // Y no pasó nada: ni se borró el renglón ni se soltó la reserva.
    expect(await renglonesDeLaOrden(orderId)).toHaveLength(1);
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 3,
    });
    expect((await estadoDeLaOrden(orderId)).status).toBe("activa");
  });

  test("confirmando, la orden queda cancelada y la reserva se suelta UNA vez", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 10,
      cantidad: 3,
    });
    const [renglon] = await renglonesDeLaOrden(orderId);

    const resultado = await enTransaccion((tx) =>
      quitarItem(tx, {
        orderId,
        orderItemId: renglon.id,
        permitirCancelar: true,
      }),
    );

    expect(resultado.ordenCancelada).toBe(true);

    const orden = await estadoDeLaOrden(orderId);
    expect(orden.status).toBe("cancelada");
    expect(orden.cancelledAt).not.toBeNull();

    // UNA sola liberación. Si la cancelación volviera a recorrer los ítems,
    // liberaría de nuevo lo que ya se soltó y la reserva se iría abajo de
    // cero — o reventaría contra el CHECK.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
    expect(await movimientos(variantId)).toHaveLength(1);

    expect(await totalDeLaOrden(orderId)).toBe("0.00");
    expect(await historial(orderId)).toMatchObject([
      { fromStatus: null, toStatus: "activa" },
      { fromStatus: "activa", toStatus: "cancelada" },
    ]);
  });
});

describe("reducir la cantidad", () => {
  test("libera sólo la diferencia y recalcula", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 20,
      cantidad: 8,
    });
    const [renglon] = await renglonesDeLaOrden(orderId);

    await enTransaccion((tx) =>
      reducirCantidad(tx, {
        orderId,
        orderItemId: renglon.id,
        nuevaCantidad: 3,
      }),
    );

    expect(await contadores(variantId)).toEqual({
      stockTotal: 20,
      reservedStock: 3,
    });
    expect(await movimientos(variantId)).toMatchObject([
      { type: "liberacion", quantity: -5, reservedAfter: 3 },
    ]);

    expect((await renglonesDeLaOrden(orderId))[0].quantity).toBe(3);
    // El andamiaje pone 1000.00 de precio unitario.
    expect(await totalDeLaOrden(orderId)).toBe("3000.00");
  });

  test("bajar a uno se puede; bajar a cero es quitar, y son cosas distintas", async () => {
    const { orderId } = await unaOrdenDeUnItem({ total: 10, cantidad: 4 });
    const [renglon] = await renglonesDeLaOrden(orderId);

    await enTransaccion((tx) =>
      reducirCantidad(tx, {
        orderId,
        orderItemId: renglon.id,
        nuevaCantidad: 1,
      }),
    );
    expect((await renglonesDeLaOrden(orderId))[0].quantity).toBe(1);

    // Colarse a la cancelación por un cero sería cancelar sin preguntar.
    await expect(
      enTransaccion((tx) =>
        reducirCantidad(tx, {
          orderId,
          orderItemId: renglon.id,
          nuevaCantidad: 0,
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  test("agregar unidades no se puede desde acá", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 10,
      cantidad: 2,
    });
    const [renglon] = await renglonesDeLaOrden(orderId);

    await expect(
      enTransaccion((tx) =>
        reducirCantidad(tx, {
          orderId,
          orderItemId: renglon.id,
          nuevaCantidad: 5,
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 2,
    });
  });

  test("dejar la misma cantidad no ensucia el libro ni el historial", async () => {
    const { orderId, variantId } = await unaOrdenDeUnItem({
      total: 10,
      cantidad: 4,
    });
    const [renglon] = await renglonesDeLaOrden(orderId);

    await enTransaccion((tx) =>
      reducirCantidad(tx, {
        orderId,
        orderItemId: renglon.id,
        nuevaCantidad: 4,
      }),
    );

    expect(await movimientos(variantId)).toHaveLength(0);
    expect(await historial(orderId)).toHaveLength(1);
  });
});

describe("sólo órdenes activas", () => {
  test("una finalizada no se edita", async () => {
    const { orderId } = await unaOrdenDeUnItem({ total: 10, cantidad: 2 });
    const [renglon] = await renglonesDeLaOrden(orderId);
    await enTransaccion((tx) => finalizarOrden(tx, { orderId }));

    await expect(
      enTransaccion((tx) =>
        quitarItem(tx, {
          orderId,
          orderItemId: renglon.id,
          permitirCancelar: true,
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_STATE" });

    await expect(
      enTransaccion((tx) =>
        reducirCantidad(tx, {
          orderId,
          orderItemId: renglon.id,
          nuevaCantidad: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_STATE" });
  });

  test("un renglón de otra orden no se toca con el id de esta", async () => {
    // Sin el `order_id` en el WHERE del renglón, mandar el id de un ítem
    // ajeno editaría esa otra orden con los permisos de esta.
    const propia = await unaOrdenDeUnItem({ total: 10, cantidad: 1 });
    const ajena = await unaOrdenDeUnItem({ total: 10, cantidad: 1 });
    const [renglonAjeno] = await renglonesDeLaOrden(ajena.orderId);

    await expect(
      enTransaccion((tx) =>
        quitarItem(tx, {
          orderId: propia.orderId,
          orderItemId: renglonAjeno.id,
          permitirCancelar: true,
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await renglonesDeLaOrden(ajena.orderId)).toHaveLength(1);
    expect(await contadores(ajena.variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 1,
    });
  });
});

test("editar mientras se finaliza: gana una sola", async () => {
  // Sin el FOR UPDATE sobre la orden, entre leer «está activa» y liberar la
  // reserva la otra transacción la finaliza: se descontaría el stock por la
  // cantidad vieja Y además se liberaría una reserva que la venta ya consumió.
  const { orderId, variantId } = await unaOrdenDeUnItem({
    total: 10,
    cantidad: 4,
  });
  const [renglon] = await renglonesDeLaOrden(orderId);

  const resultados = await dosALaVez(
    (tx) => finalizarOrden(tx, { orderId }),
    (tx) =>
      reducirCantidad(tx, {
        orderId,
        orderItemId: renglon.id,
        nuevaCantidad: 1,
      }),
  );

  expect(resultados[0].status).toBe("fulfilled");
  expect(resultados[1]).toMatchObject({
    status: "rejected",
    reason: { code: "INVALID_ORDER_STATE" },
  });

  // Se vendieron las 4 y no quedó reserva colgada.
  expect(await contadores(variantId)).toEqual({
    stockTotal: 6,
    reservedStock: 0,
  });
  expect(await movimientos(variantId)).toMatchObject([
    { type: "venta", quantity: -4 },
  ]);
});
