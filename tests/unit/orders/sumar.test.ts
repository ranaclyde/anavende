import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { isDomainError } from "@/lib/errors";
import { agregarItem, aumentarCantidad } from "@/modules/orders/editar";
import { finalizarOrden } from "@/modules/orders/estados";
import { contadores, limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import {
  historial,
  limpiarOrdenes,
  renglonesDeLaOrden,
  totalDeLaOrden,
  unaOrdenActiva,
} from "@/tests/apoyo/ordenes";

/**
 * F7.2a — sumar a una orden activa. RF-22 «Criterios — sumar» · TS §8.1, §8.2.
 *
 * «Hecho cuando»: se sube la cantidad de un renglón y se agrega un producto
 * que no estaba, reservando con el `UPDATE` condicional de §8.2; sin stock no
 * se agrega y se dice cuánto hay.
 *
 * **Es la mitad que puede fallar**, y de ahí salen casi todos los tests: la
 * reserva puede no entrar, y cuando no entra nada tiene que quedar a medias —
 * ni el renglón nuevo, ni la cantidad subida, ni una fila de historial
 * contando algo que no pasó.
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

/** Una orden de un renglón: 2 unidades reservadas de una variante con 10. */
async function unaOrdenDe(stock = 10, cantidad = 2) {
  const v = await unaVariante({ total: stock, reservado: cantidad });
  const { orderId } = await unaOrdenActiva([
    { variantId: v.variantId, quantity: cantidad, unitPrice: "1500.00" },
  ]);
  await db.execute(sql`
    UPDATE orders SET total = '3000.00' WHERE id = ${orderId}`);
  const [renglon] = await renglonesDeLaOrden(orderId);
  return { orderId, variantId: v.variantId, itemId: renglon.id };
}

describe("subir la cantidad de un renglón", () => {
  test("reserva sólo la diferencia y recalcula el total", async () => {
    const { orderId, variantId, itemId } = await unaOrdenDe();

    await enTransaccion((tx) =>
      aumentarCantidad(tx, { orderId, orderItemId: itemId, nuevaCantidad: 5 }),
    );

    // De 2 a 5 son tres unidades más, no cinco: la reserva vieja ya estaba.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 5,
    });
    expect(await totalDeLaOrden(orderId)).toBe("7500.00");
    expect((await renglonesDeLaOrden(orderId))[0].quantity).toBe(5);
  });

  test("las unidades nuevas van al precio del renglón, no al del catálogo", async () => {
    const { orderId, itemId } = await unaOrdenDe();

    // El producto del apoyo vale $1000 y este renglón se acordó a $1500: lo
    // que el comprador vio y aceptó es $1500, y sumar no cambia el trato.
    await enTransaccion((tx) =>
      aumentarCantidad(tx, { orderId, orderItemId: itemId, nuevaCantidad: 3 }),
    );

    const [renglon] = await db.execute<{ unitPrice: string }>(sql`
      SELECT unit_price AS "unitPrice" FROM order_items WHERE order_id = ${orderId}`);
    expect(renglon.unitPrice).toBe("1500.00");
    expect(await totalDeLaOrden(orderId)).toBe("4500.00");
  });

  test("queda en el historial con quién y qué pasó", async () => {
    const { orderId, itemId } = await unaOrdenDe();

    await enTransaccion((tx) =>
      aumentarCantidad(tx, {
        orderId,
        orderItemId: itemId,
        nuevaCantidad: 4,
        actorUserId: null,
      }),
    );

    const filas = await historial(orderId);
    expect(filas.at(-1)).toMatchObject({
      fromStatus: "activa",
      toStatus: "activa",
    });
    expect(filas.at(-1)!.reason).toMatch(/pasó de 2 a 4/);
  });

  test("sin stock no sube, y dice cuántas quedan", async () => {
    // 4 en total con 2 reservadas por esta orden: quedan 2 disponibles.
    const { orderId, variantId, itemId } = await unaOrdenDe(4, 2);

    const error = await enTransaccion((tx) =>
      aumentarCantidad(tx, { orderId, orderItemId: itemId, nuevaCantidad: 9 }),
    ).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("INSUFFICIENT_STOCK");
    // RF-22 pide que se diga cuánto hay: sin ese número, quien lee no sabe
    // si pedir menos o cargar stock.
    expect(String((error as Error).message)).toContain("2 unidades");

    // Y no quedó nada a medias: ni la cantidad, ni la reserva, ni el total.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 4,
      reservedStock: 2,
    });
    expect((await renglonesDeLaOrden(orderId))[0].quantity).toBe(2);
    expect(await totalDeLaOrden(orderId)).toBe("3000.00");
    expect(await historial(orderId)).toHaveLength(1);
  });

  test("bajar desde acá no se puede: para eso está reducir", async () => {
    const { orderId, itemId } = await unaOrdenDe();

    const error = await enTransaccion((tx) =>
      aumentarCantidad(tx, { orderId, orderItemId: itemId, nuevaCantidad: 1 }),
    ).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("VALIDATION");
  });

  test("sobre una orden que ya no está activa, nada (RF-13)", async () => {
    const { orderId, variantId, itemId } = await unaOrdenDe();
    await enTransaccion((tx) => finalizarOrden(tx, { orderId }));

    const error = await enTransaccion((tx) =>
      aumentarCantidad(tx, { orderId, orderItemId: itemId, nuevaCantidad: 5 }),
    ).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("INVALID_ORDER_STATE");
    // Finalizar dejó 8 en stock y la reserva consumida; nada se movió después.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 8,
      reservedStock: 0,
    });
  });
});

describe("agregar un producto que no estaba", () => {
  test("lo suma al precio vigente del catálogo y lo reserva", async () => {
    const { orderId } = await unaOrdenDe();
    const nueva = await unaVariante({ total: 6 });

    const r = await enTransaccion((tx) =>
      agregarItem(tx, {
        orderId,
        variantId: nueva.variantId,
        cantidad: 2,
      }),
    );

    expect(r).toEqual({ sumadoAlRenglon: false, cantidad: 2 });
    expect(await contadores(nueva.variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 2,
    });

    // El producto del apoyo vale $1000: entra a ese precio, no al del otro
    // renglón, y queda congelado (RN-12).
    const renglones = await renglonesDeLaOrden(orderId);
    expect(renglones).toHaveLength(2);
    expect(await totalDeLaOrden(orderId)).toBe("5000.00");

    const filas = await historial(orderId);
    expect(filas.at(-1)!.reason).toMatch(/Se agregó/);
  });

  test("si ya está en la orden, suma sobre su renglón y no crea otro", async () => {
    const { orderId, variantId, itemId } = await unaOrdenDe();

    const r = await enTransaccion((tx) =>
      agregarItem(tx, { orderId, variantId, cantidad: 3 }),
    );

    // RF-22: como el carrito (RF-08). Dos líneas del mismo color serían la
    // misma cosa contada dos veces.
    expect(r).toEqual({ sumadoAlRenglon: true, cantidad: 5 });
    const renglones = await renglonesDeLaOrden(orderId);
    expect(renglones).toHaveLength(1);
    expect(renglones[0].id).toBe(itemId);
    expect(renglones[0].quantity).toBe(5);
    // Y al precio del renglón, no al del catálogo: $1500, no $1000.
    expect(await totalDeLaOrden(orderId)).toBe("7500.00");
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 5,
    });
  });

  test("sin stock no se agrega, y no queda el renglón a medias", async () => {
    const { orderId } = await unaOrdenDe();
    const sinStock = await unaVariante({ total: 1 });

    const error = await enTransaccion((tx) =>
      agregarItem(tx, { orderId, variantId: sinStock.variantId, cantidad: 4 }),
    ).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("INSUFFICIENT_STOCK");
    expect(String((error as Error).message)).toContain("queda 1 unidad");

    expect(await renglonesDeLaOrden(orderId)).toHaveLength(1);
    expect(await totalDeLaOrden(orderId)).toBe("3000.00");
    expect(await contadores(sinStock.variantId)).toEqual({
      stockTotal: 1,
      reservedStock: 0,
    });
  });

  test("con el stock en cero lo dice sin hablar de unidades que quedan", async () => {
    const { orderId } = await unaOrdenDe();
    const agotada = await unaVariante({ total: 0 });

    const error = await enTransaccion((tx) =>
      agregarItem(tx, { orderId, variantId: agotada.variantId, cantidad: 1 }),
    ).catch((e: unknown) => e);

    expect(String((error as Error).message)).toContain("No queda stock");
  });

  test("una variante que no existe corta todo", async () => {
    const { orderId } = await unaOrdenDe();

    const error = await enTransaccion((tx) =>
      agregarItem(tx, {
        orderId,
        variantId: "00000000-0000-0000-0000-000000000000",
        cantidad: 1,
      }),
    ).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("NOT_FOUND");
    expect(await renglonesDeLaOrden(orderId)).toHaveLength(1);
  });

  test("a una orden finalizada no se le agrega nada (RF-13)", async () => {
    const { orderId } = await unaOrdenDe();
    const nueva = await unaVariante({ total: 6 });
    await enTransaccion((tx) => finalizarOrden(tx, { orderId }));

    const error = await enTransaccion((tx) =>
      agregarItem(tx, { orderId, variantId: nueva.variantId, cantidad: 1 }),
    ).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("INVALID_ORDER_STATE");
    expect(await contadores(nueva.variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });
  });

  test("cantidad cero o disparatada se rechaza antes de tocar nada", async () => {
    const { orderId } = await unaOrdenDe();
    const nueva = await unaVariante({ total: 6 });

    for (const cantidad of [0, -3, 10_000, 1.5]) {
      const error = await enTransaccion((tx) =>
        agregarItem(tx, { orderId, variantId: nueva.variantId, cantidad }),
      ).catch((e: unknown) => e);
      expect(isDomainError(error) && error.code).toBe("VALIDATION");
    }

    expect(await contadores(nueva.variantId)).toMatchObject({
      reservedStock: 0,
    });
  });
});
