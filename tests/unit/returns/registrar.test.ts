import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { finalizarOrden } from "@/modules/orders/estados";
import {
  anularDevolucion,
  registrarDevolucion,
} from "@/modules/returns/registrar";
import {
  contadores,
  limpiar,
  movimientos,
  unaVariante,
} from "@/tests/apoyo/catalogo";
import {
  limpiarOrdenes,
  renglonesDeLaOrden,
  unaOrdenActiva,
  unaOrdenDeUnItem,
} from "@/tests/apoyo/ordenes";

/**
 * F4.5 — devoluciones con y sin reposición. RF-25 · §5.7, §8.1.
 *
 * «Hecho cuando»: no permite devolver más de lo vendido, y la anulación
 * revierte el efecto en stock.
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

/**
 * Una orden ya finalizada: es la única sobre la que se devuelve.
 * Con `total: 10` y `cantidad: 4`, la venta deja el stock en 6.
 *
 * En el libro mayor de la variante queda UN solo asiento previo, el de la
 * venta: el andamiaje pone la reserva escribiendo el contador directo, sin
 * pasar por `reservar()`, porque acá se arma un escenario y no se prueba esa
 * operación.
 */
async function ordenVendida(cantidad = 4) {
  const { orderId, variantId } = await unaOrdenDeUnItem({
    total: 10,
    cantidad,
  });
  await enTransaccion((tx) => finalizarOrden(tx, { orderId }));
  const [renglon] = await renglonesDeLaOrden(orderId);
  return { orderId, variantId, orderItemId: renglon.id };
}

async function estadoDeLaDevolucion(returnId: string) {
  const [fila] = await db.execute<{
    status: string;
    voidReason: string | null;
    voidedAt: string | null;
  }>(sql`
    SELECT status, void_reason AS "voidReason", voided_at AS "voidedAt"
      FROM returns WHERE id = ${returnId}`);
  return fila;
}

describe("con reposición", () => {
  test("suma al stock total y lo asienta como devolución", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "No le gustó el color",
        items: [{ orderItemId, quantity: 3, restocks: true }],
      }),
    );

    // 10 − 4 vendidas = 6, y vuelven 3.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 9,
      reservedStock: 0,
    });

    const libro = await movimientos(variantId);
    expect(libro.map((m) => [m.type, m.quantity])).toEqual([
      ["venta", -4],
      ["devolucion", 3],
    ]);
    expect(libro.at(-1)?.returnId).not.toBeNull();
  });
});

describe("sin reposición", () => {
  test("no toca el stock, pero la devolución queda registrada", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    const { returnId } = await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Vino fallado",
        items: [{ orderItemId, quantity: 2, restocks: false }],
      }),
    );

    // El producto volvió roto: no hay nada que vender.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });
    expect(await movimientos(variantId)).toHaveLength(1); // sólo la venta

    // Pero existe: los reportes de RF-28 la descuentan de las ventas netas.
    expect((await estadoDeLaDevolucion(returnId)).status).toBe("registrada");
  });

  test("una devolución mixta repone sólo lo que está en condiciones", async () => {
    const a = await unaVariante({ total: 10, reservado: 3 });
    const b = await unaVariante({ total: 10, reservado: 3 });
    const { orderId } = await unaOrdenActiva([
      { variantId: a.variantId, quantity: 3 },
      { variantId: b.variantId, quantity: 3 },
    ]);
    await enTransaccion((tx) => finalizarOrden(tx, { orderId }));
    const renglones = await renglonesDeLaOrden(orderId);

    await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Devolución parcial",
        items: [
          { orderItemId: renglones[0].id, quantity: 2, restocks: true },
          { orderItemId: renglones[1].id, quantity: 2, restocks: false },
        ],
      }),
    );

    expect((await contadores(a.variantId)).stockTotal).toBe(9); // 7 + 2
    expect((await contadores(b.variantId)).stockTotal).toBe(7); // sigue en 7
  });
});

describe("no más de lo vendido (RF-25)", () => {
  test("devolver más de lo vendido se rechaza y no deja nada", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    const fallo = (await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Se arrepintió",
        items: [{ orderItemId, quantity: 5, restocks: true }],
      }),
    ).catch((e: unknown) => e)) as { code: string; message: string };

    expect(fallo.code).toBe("RETURN_EXCEEDS_SOLD");
    expect(fallo.message).toContain("se vendieron 4");

    expect(await contadores(variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });
    const [{ n }] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM returns WHERE order_id = ${orderId}`);
    expect(n).toBe(0);
  });

  test("tampoco de a poco: lo ya devuelto cuenta", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Primera tanda",
        items: [{ orderItemId, quantity: 3, restocks: true }],
      }),
    );

    const fallo = (await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Segunda tanda",
        items: [{ orderItemId, quantity: 2, restocks: true }],
      }),
    ).catch((e: unknown) => e)) as { code: string; message: string };

    expect(fallo.code).toBe("RETURN_EXCEEDS_SOLD");
    expect(fallo.message).toContain("quedan 1");
    expect((await contadores(variantId)).stockTotal).toBe(9);
  });

  test("devolver justo lo que falta sí entra", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Primera",
        items: [{ orderItemId, quantity: 3, restocks: true }],
      }),
    );
    await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Segunda",
        items: [{ orderItemId, quantity: 1, restocks: true }],
      }),
    );

    // Volvió todo lo vendido: el stock quedó como antes de la venta.
    expect((await contadores(variantId)).stockTotal).toBe(10);
  });

  test("dos renglones para el mismo producto se rechazan", async () => {
    // Se validarían por separado contra el mismo tope y pasarían los dos.
    const { orderId, orderItemId } = await ordenVendida(4);

    await expect(
      enTransaccion((tx) =>
        registrarDevolucion(tx, {
          orderId,
          reason: "Truco",
          items: [
            { orderItemId, quantity: 3, restocks: true },
            { orderItemId, quantity: 3, restocks: true },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  test("un renglón de otra orden es NOT_FOUND", async () => {
    const propia = await ordenVendida(2);
    const ajena = await ordenVendida(2);

    await expect(
      enTransaccion((tx) =>
        registrarDevolucion(tx, {
          orderId: propia.orderId,
          reason: "Contra la orden equivocada",
          items: [
            { orderItemId: ajena.orderItemId, quantity: 1, restocks: true },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("sólo contra órdenes finalizadas", () => {
  test("una orden activa no admite devoluciones", async () => {
    const { orderId } = await unaOrdenDeUnItem({ total: 10, cantidad: 2 });
    const [renglon] = await renglonesDeLaOrden(orderId);

    // Lo que todavía no se entregó se edita o se cancela, no se devuelve.
    await expect(
      enTransaccion((tx) =>
        registrarDevolucion(tx, {
          orderId,
          reason: "Todavía no la recibió",
          items: [{ orderItemId: renglon.id, quantity: 1, restocks: true }],
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_STATE" });
  });
});

describe("anular (RF-25)", () => {
  test("revierte lo repuesto y deja el motivo", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    const { returnId } = await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Cargada mal",
        items: [{ orderItemId, quantity: 3, restocks: true }],
      }),
    );
    expect((await contadores(variantId)).stockTotal).toBe(9);

    await enTransaccion((tx) =>
      anularDevolucion(tx, {
        returnId,
        voidReason: "Era otra orden",
      }),
    );

    const devolucion = await estadoDeLaDevolucion(returnId);
    expect(devolucion.status).toBe("anulada");
    expect(devolucion.voidReason).toBe("Era otra orden");
    expect(devolucion.voidedAt).not.toBeNull();

    // El stock volvió a lo que era, y el libro lo cuenta con el mismo tipo de
    // asiento y el signo dado vuelta: la devolución de la devolución.
    expect((await contadores(variantId)).stockTotal).toBe(6);
    expect(await movimientos(variantId)).toMatchObject([
      { type: "venta" },
      { type: "devolucion", quantity: 3 },
      { type: "devolucion", quantity: -3, stockAfter: 6 },
    ]);
  });

  test("anular una sin reposición no toca el stock", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    const { returnId } = await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Fallada",
        items: [{ orderItemId, quantity: 2, restocks: false }],
      }),
    );

    await enTransaccion((tx) =>
      anularDevolucion(tx, { returnId, voidReason: "No era fallada" }),
    );

    // Nunca entró al stock: no hay nada que sacar.
    expect((await contadores(variantId)).stockTotal).toBe(6);
    expect(await movimientos(variantId)).toHaveLength(1);
  });

  test("lo anulado libera el cupo y se puede volver a cargar", async () => {
    // Es lo que RF-25 quiere al decir «se anula y se vuelve a cargar».
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    const { returnId } = await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Cargada con la cantidad equivocada",
        items: [{ orderItemId, quantity: 4, restocks: true }],
      }),
    );
    await enTransaccion((tx) =>
      anularDevolucion(tx, { returnId, voidReason: "Eran 2, no 4" }),
    );

    await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Ahora sí",
        items: [{ orderItemId, quantity: 2, restocks: true }],
      }),
    );

    expect((await contadores(variantId)).stockTotal).toBe(8);
  });

  test("anular dos veces: la segunda no revierte de nuevo", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    const { returnId } = await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Cargada mal",
        items: [{ orderItemId, quantity: 3, restocks: true }],
      }),
    );
    await enTransaccion((tx) =>
      anularDevolucion(tx, { returnId, voidReason: "Primera anulación" }),
    );

    await expect(
      enTransaccion((tx) =>
        anularDevolucion(tx, { returnId, voidReason: "Otra vez" }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_STATE" });

    // Y sobre todo: no se descontó dos veces.
    expect((await contadores(variantId)).stockTotal).toBe(6);
  });

  test("no se puede anular si eso dejaría el stock bajo lo reservado", async () => {
    const { orderId, orderItemId, variantId } = await ordenVendida(4);

    const { returnId } = await enTransaccion((tx) =>
      registrarDevolucion(tx, {
        orderId,
        reason: "Devolución",
        items: [{ orderItemId, quantity: 4, restocks: true }],
      }),
    );
    // Vuelve a 10, y alguien reserva 9 de esas unidades.
    await db.execute(sql`
      UPDATE product_variants SET reserved_stock = 9 WHERE id = ${variantId}`);

    await expect(
      enTransaccion((tx) =>
        anularDevolucion(tx, { returnId, voidReason: "Me arrepentí" }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 9,
    });
    expect((await estadoDeLaDevolucion(returnId)).status).toBe("registrada");
  });
});
