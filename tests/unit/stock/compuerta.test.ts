import { sql } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";

import { db } from "@/db";
import { finalizarOrden } from "@/modules/orders/estados";
import {
  ajustar,
  liberar,
  reponer,
  reservar,
  revertirReposicion,
  vender,
} from "@/modules/stock/operaciones";
import { contadores, limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { dosALaVez } from "@/tests/apoyo/concurrencia";
import {
  limpiarOrdenes,
  renglonesDeLaOrden,
  unaOrdenActiva,
} from "@/tests/apoyo/ordenes";
import {
  anularDevolucion,
  registrarDevolucion,
} from "@/modules/returns/registrar";

/**
 * Compuerta F4: dos reservas simultáneas sobre la última unidad dan una orden
 * y un `INSUFFICIENT_STOCK`, nunca dos; y el libro mayor cuadra con los
 * contadores.
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
 * El stock entra por `ajustar()` y no escrito directo, como en el alta del
 * panel: el libro solo cuadra si también registra la primera carga.
 */
async function unaVarianteConLibro(total: number): Promise<string> {
  const { variantId } = await unaVariante({ total: 0 });
  if (total !== 0) {
    await enTransaccion((tx) =>
      ajustar(tx, { variantId, nuevoTotal: total, note: "Carga inicial" }),
    );
  }
  return variantId;
}

test("COMPUERTA F4 — dos reservas sobre la última unidad: una gana, una falla", async () => {
  const variantId = await unaVarianteConLibro(1);

  // Solapadas de verdad: la segunda llega al UPDATE mientras la primera
  // todavía no commiteó y se queda esperando el bloqueo de la fila. Cuando se
  // despierta, la fila ya cambió — ese es el instante que decide todo.
  const resultados = await dosALaVez(
    (tx) => reservar(tx, { variantId, quantity: 1 }),
    (tx) => reservar(tx, { variantId, quantity: 1 }),
  );

  expect(resultados[0].status).toBe("fulfilled");
  expect(resultados[1]).toMatchObject({
    status: "rejected",
    reason: { code: "INSUFFICIENT_STOCK" },
  });

  // Si esto diera 2, se vendió dos veces la misma unidad.
  expect(await contadores(variantId)).toEqual({
    stockTotal: 1,
    reservedStock: 1,
  });
  await expect(cuadraElLibro(variantId)).resolves.toBe(true);
});

test("y con más de una unidad, entra el que cabe y no el que sobra", async () => {
  // Un «hay stock» sin condición dejaría pasar los dos pedidos de 2.
  const variantId = await unaVarianteConLibro(3);

  const resultados = await dosALaVez(
    (tx) => reservar(tx, { variantId, quantity: 2 }),
    (tx) => reservar(tx, { variantId, quantity: 2 }),
  );

  expect(resultados[0].status).toBe("fulfilled");
  expect(resultados[1]).toMatchObject({
    status: "rejected",
    reason: { code: "INSUFFICIENT_STOCK" },
  });
  expect(await contadores(variantId)).toEqual({
    stockTotal: 3,
    reservedStock: 2,
  });
});

test("dos que sí entran no se estorban", async () => {
  // El bloqueo no puede rechazar lo legítimo.
  const variantId = await unaVarianteConLibro(5);

  const resultados = await dosALaVez(
    (tx) => reservar(tx, { variantId, quantity: 2 }),
    (tx) => reservar(tx, { variantId, quantity: 3 }),
  );

  expect(resultados.every((r) => r.status === "fulfilled")).toBe(true);
  expect(await contadores(variantId)).toEqual({
    stockTotal: 5,
    reservedStock: 5,
  });
  await expect(cuadraElLibro(variantId)).resolves.toBe(true);
});

/**
 * Devuelve `true` o falla diciendo qué no cerró: la suma de los movimientos
 * que mueven el total da `stock_total` (signo o cantidad mal asentados), y el
 * último asiento coincide con los contadores (un cambio hecho SIN asentar, que
 * la suma sola no ve).
 */
async function cuadraElLibro(variantId: string): Promise<boolean> {
  const actual = await contadores(variantId);

  const [suma] = await db.execute<{ total: number }>(sql`
    SELECT COALESCE(SUM(quantity), 0)::int AS total
      FROM stock_movements
     WHERE variant_id = ${variantId}
       AND type IN ('ajuste', 'venta', 'devolucion')`);

  expect(suma.total).toBe(actual.stockTotal);

  const [ultimo] = await db.execute<{
    stockAfter: number;
    reservedAfter: number;
  }>(sql`
    SELECT stock_after AS "stockAfter", reserved_after AS "reservedAfter"
      FROM stock_movements
     WHERE variant_id = ${variantId}
     ORDER BY created_at DESC, id DESC
     LIMIT 1`);

  if (ultimo) {
    expect({
      stockTotal: ultimo.stockAfter,
      reservedStock: ultimo.reservedAfter,
    }).toEqual(actual);
  }

  return true;
}

test("el libro cuadra después de las seis operaciones seguidas", async () => {
  const { variantId } = await unaVariante({ total: 0 });

  await enTransaccion(async (tx) => {
    await ajustar(tx, { variantId, nuevoTotal: 20 });
    await reservar(tx, { variantId, quantity: 8 });
    await liberar(tx, { variantId, quantity: 3 });
    await vender(tx, { variantId, quantity: 5 });
    await reponer(tx, { variantId, quantity: 2 });
    await revertirReposicion(tx, { variantId, quantity: 1 });
  });

  // 20 − 5 + 2 − 1 = 16, sin reservas colgadas.
  expect(await contadores(variantId)).toEqual({
    stockTotal: 16,
    reservedStock: 0,
  });
  await expect(cuadraElLibro(variantId)).resolves.toBe(true);
});

test("el libro cuadra después de una vida entera de la variante", async () => {
  // Todo por el módulo, incluida la corrección a mano en el medio.
  const variantId = await unaVarianteConLibro(12);
  await enTransaccion((tx) => reservar(tx, { variantId, quantity: 5 }));
  const { orderId } = await unaOrdenActiva([{ variantId, quantity: 5 }]);

  await enTransaccion((tx) => finalizarOrden(tx, { orderId }));
  const [renglon] = await renglonesDeLaOrden(orderId);

  const { returnId } = await enTransaccion((tx) =>
    registrarDevolucion(tx, {
      orderId,
      reason: "No era lo que esperaba",
      items: [{ orderItemId: renglon.id, quantity: 3, restocks: true }],
    }),
  );

  await enTransaccion((tx) =>
    ajustar(tx, { variantId, nuevoTotal: 30, note: "Llegó mercadería" }),
  );

  await enTransaccion((tx) =>
    anularDevolucion(tx, { returnId, voidReason: "Estaba mal cargada" }),
  );

  await enTransaccion((tx) => reservar(tx, { variantId, quantity: 4 }));

  expect(await contadores(variantId)).toEqual({
    stockTotal: 27, // 30 puesto a mano, menos las 3 que la anulación sacó
    reservedStock: 4,
  });
  await expect(cuadraElLibro(variantId)).resolves.toBe(true);
});

test("un cambio hecho SIN asentar rompe el cuadre, que es lo que se le pide", async () => {
  // Un UPDATE suelto que se saltea `modules/stock` tiene que quedar delatado.
  const variantId = await unaVarianteConLibro(10);
  await enTransaccion((tx) => reservar(tx, { variantId, quantity: 2 }));
  await expect(cuadraElLibro(variantId)).resolves.toBe(true);

  await db.execute(sql`
    UPDATE product_variants SET stock_total = 99 WHERE id = ${variantId}`);

  await expect(cuadraElLibro(variantId)).rejects.toThrow();
});
