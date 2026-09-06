import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { DomainError } from "@/lib/errors";
import {
  ajustar,
  liberar,
  reponer,
  reservar,
  vender,
} from "@/modules/stock/operaciones";
import {
  contadores,
  limpiar,
  movimientos,
  unaVariante,
  unProducto,
} from "@/tests/apoyo/catalogo";

/**
 * F4.1 — las cinco operaciones de stock, contra Postgres de verdad.
 *
 * `TECHNICAL-SPEC.md` §17.1 lo pide así y no con un doble de prueba: lo que se
 * verifica son transacciones y `CHECK` constraints, y un *mock* diría que sí a
 * todo. El «Hecho cuando» de F4.1 son dos cosas —las cinco operaciones, y que
 * cada una escriba en `stock_movements` EN LA MISMA TRANSACCIÓN—, así que cada
 * bloque de acá comprueba las dos.
 */

afterEach(limpiar);

/** Azúcar: casi todo se ejecuta dentro de una transacción de una operación. */
function enTransaccion<T>(
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}

describe("reservar", () => {
  test("sube la reserva, no toca el total, y lo asienta", async () => {
    const { variantId } = await unaVariante({ total: 10 });

    await enTransaccion((tx) => reservar(tx, { variantId, quantity: 3 }));

    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 3,
    });

    const libro = await movimientos(variantId);
    expect(libro).toHaveLength(1);
    expect(libro[0]).toMatchObject({
      type: "reserva",
      // Con signo, sobre el contador que mueve: la reserva.
      quantity: 3,
      stockAfter: 10,
      reservedAfter: 3,
    });
  });

  test("la última unidad se puede reservar entera", async () => {
    const { variantId } = await unaVariante({ total: 4, reservado: 3 });

    await enTransaccion((tx) => reservar(tx, { variantId, quantity: 1 }));

    expect(await contadores(variantId)).toEqual({
      stockTotal: 4,
      reservedStock: 4,
    });
  });

  test("sin disponible da INSUFFICIENT_STOCK y no deja rastro", async () => {
    const { variantId } = await unaVariante({ total: 5, reservado: 4 });

    await expect(
      enTransaccion((tx) => reservar(tx, { variantId, quantity: 2 })),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    // Ni el contador se movió ni quedó un asiento a medias.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 5,
      reservedStock: 4,
    });
    expect(await movimientos(variantId)).toHaveLength(0);
  });

  test("lo que se reserva contra el total, no contra lo ya reservado", async () => {
    // Un total de 5 con 4 reservadas deja UNA disponible, no cinco. Es el
    // error clásico de mirar el contador equivocado.
    const { variantId } = await unaVariante({ total: 5, reservado: 4 });

    await expect(
      enTransaccion((tx) => reservar(tx, { variantId, quantity: 5 })),
    ).rejects.toBeInstanceOf(DomainError);

    await enTransaccion((tx) => reservar(tx, { variantId, quantity: 1 }));
    expect(await contadores(variantId)).toEqual({
      stockTotal: 5,
      reservedStock: 5,
    });
  });

  test("una variante que no existe es NOT_FOUND, no falta de stock", async () => {
    await expect(
      enTransaccion((tx) =>
        reservar(tx, {
          variantId: "00000000-0000-0000-0000-000000000000",
          quantity: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("liberar", () => {
  test("baja la reserva y lo asienta con signo negativo", async () => {
    const { variantId } = await unaVariante({ total: 10, reservado: 4 });

    await enTransaccion((tx) =>
      liberar(tx, { variantId, quantity: 3, note: "Orden cancelada" }),
    );

    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 1,
    });

    const libro = await movimientos(variantId);
    expect(libro[0]).toMatchObject({
      type: "liberacion",
      quantity: -3,
      stockAfter: 10,
      reservedAfter: 1,
      note: "Orden cancelada",
    });
  });

  test("liberar más de lo reservado NO es un error de negocio", async () => {
    const { variantId } = await unaVariante({ total: 10, reservado: 2 });

    // Nadie tiene que ver esto en pantalla: significa que la orden y el stock
    // se desincronizaron, y eso se arregla, no se muestra.
    const fallo = await enTransaccion((tx) =>
      liberar(tx, { variantId, quantity: 3 }),
    ).catch((e: unknown) => e);

    expect(fallo).toBeInstanceOf(Error);
    expect(fallo).not.toBeInstanceOf(DomainError);
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 2,
    });
  });
});

describe("vender", () => {
  test("descuenta del total y libera la reserva de una", async () => {
    const { variantId } = await unaVariante({ total: 10, reservado: 4 });

    await enTransaccion((tx) => vender(tx, { variantId, quantity: 4 }));

    expect(await contadores(variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });

    const libro = await movimientos(variantId);
    expect(libro[0]).toMatchObject({
      type: "venta",
      quantity: -4,
      stockAfter: 6,
      reservedAfter: 0,
    });
  });

  test("vender sin reserva previa está mal y revienta", async () => {
    const { variantId } = await unaVariante({ total: 10, reservado: 1 });

    const fallo = await enTransaccion((tx) =>
      vender(tx, { variantId, quantity: 3 }),
    ).catch((e: unknown) => e);

    expect(fallo).toBeInstanceOf(Error);
    expect(fallo).not.toBeInstanceOf(DomainError);
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 1,
    });
  });

  describe("la venta que nunca se reservó (RF-24)", () => {
    test("descuenta el total sin tocar la reserva", async () => {
      const { variantId } = await unaVariante({ total: 10, reservado: 2 });

      await enTransaccion((tx) =>
        vender(tx, { variantId, quantity: 3, desdeReserva: false }),
      );

      expect(await contadores(variantId)).toEqual({
        stockTotal: 7,
        reservedStock: 2,
      });
    });

    test("puede dejar el total NEGATIVO, y eso es lo correcto", async () => {
      // §5.4 decidió no poner CHECK de no-negatividad para no obligar a la
      // vendedora a mentirle al sistema sobre una venta que ya ocurrió. El
      // negativo es una señal de discrepancia, no un dato inválido.
      const { variantId } = await unaVariante({ total: 1 });

      await enTransaccion((tx) =>
        vender(tx, { variantId, quantity: 4, desdeReserva: false }),
      );

      expect(await contadores(variantId)).toEqual({
        stockTotal: -3,
        reservedStock: 0,
      });
    });

    test("pero no puede dejar el total por debajo de lo comprometido", async () => {
      // Bajar de 10 a 4 con 6 reservadas está bien; a 3 no, porque esas 6
      // unidades ya tienen dueño. Sale como resultado del negocio y no como
      // una violación de integridad que Sentry contaría como incidente.
      const { variantId } = await unaVariante({ total: 10, reservado: 6 });

      await expect(
        enTransaccion((tx) =>
          vender(tx, { variantId, quantity: 7, desdeReserva: false }),
        ),
      ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

      expect(await contadores(variantId)).toEqual({
        stockTotal: 10,
        reservedStock: 6,
      });
    });
  });
});

describe("reponer", () => {
  test("sube el total y lo asienta como devolución", async () => {
    const { variantId } = await unaVariante({ total: 2 });

    await enTransaccion((tx) => reponer(tx, { variantId, quantity: 3 }));

    expect(await contadores(variantId)).toEqual({
      stockTotal: 5,
      reservedStock: 0,
    });

    const libro = await movimientos(variantId);
    expect(libro[0]).toMatchObject({
      type: "devolucion",
      quantity: 3,
      stockAfter: 5,
      reservedAfter: 0,
    });
  });

  test("repone sobre un total negativo y lo acerca a cero", async () => {
    const { variantId } = await unaVariante({ total: -2 });

    await enTransaccion((tx) => reponer(tx, { variantId, quantity: 1 }));

    expect(await contadores(variantId)).toEqual({
      stockTotal: -1,
      reservedStock: 0,
    });
  });
});

describe("ajustar", () => {
  test("fija el total y asienta LA DIFERENCIA, no el número nuevo", async () => {
    const { variantId } = await unaVariante({ total: 4 });

    await enTransaccion((tx) =>
      ajustar(tx, { variantId, nuevoTotal: 7, note: "Recuento de caja" }),
    );

    expect(await contadores(variantId)).toEqual({
      stockTotal: 7,
      reservedStock: 0,
    });

    const libro = await movimientos(variantId);
    expect(libro[0]).toMatchObject({
      type: "ajuste",
      quantity: 3,
      stockAfter: 7,
      note: "Recuento de caja",
    });
  });

  test("un ajuste hacia abajo asienta un negativo", async () => {
    const { variantId } = await unaVariante({ total: 9 });

    await enTransaccion((tx) => ajustar(tx, { variantId, nuevoTotal: 2 }));

    const libro = await movimientos(variantId);
    expect(libro[0]).toMatchObject({ quantity: -7, stockAfter: 2 });
  });

  test("guardar el mismo número no ensucia el libro", async () => {
    const { variantId } = await unaVariante({ total: 5 });

    await enTransaccion((tx) => ajustar(tx, { variantId, nuevoTotal: 5 }));

    expect(await movimientos(variantId)).toHaveLength(0);
    expect(await contadores(variantId)).toEqual({
      stockTotal: 5,
      reservedStock: 0,
    });
  });

  test("no puede bajar de lo reservado, y el mensaje dice cuánto hay", async () => {
    const { variantId } = await unaVariante({ total: 10, reservado: 6 });

    const fallo = (await enTransaccion((tx) =>
      ajustar(tx, { variantId, nuevoTotal: 5 }),
    ).catch((e: unknown) => e)) as DomainError;

    expect(fallo).toBeInstanceOf(DomainError);
    expect(fallo.code).toBe("INSUFFICIENT_STOCK");
    expect(fallo.message).toContain("6 unidades reservadas");
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 6,
    });
  });

  test("bajar hasta justo lo reservado sí se puede", async () => {
    const { variantId } = await unaVariante({ total: 10, reservado: 6 });

    await enTransaccion((tx) => ajustar(tx, { variantId, nuevoTotal: 6 }));

    expect(await contadores(variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 6,
    });
  });

  test("ajusta una variante recién insertada en la MISMA transacción", async () => {
    // Es exactamente lo que hace el alta de variantes del panel desde F4.1:
    // la fila nace en cero y el número del formulario entra como movimiento.
    // El `SELECT … FOR UPDATE` de `ajustar()` tiene que ver una fila que
    // todavía no commiteó nadie, que es la parte que no se ve leyendo el
    // código.
    const productId = await unProducto();

    const variantId = await enTransaccion(async (tx) => {
      const [nueva] = await tx.execute<{ id: string }>(sql`
        INSERT INTO product_variants (product_id)
        VALUES (${productId}) RETURNING id`);

      await ajustar(tx, {
        variantId: nueva.id,
        nuevoTotal: 12,
        note: "Stock inicial de la variante",
      });

      return nueva.id;
    });

    expect(await contadores(variantId)).toEqual({
      stockTotal: 12,
      reservedStock: 0,
    });
    expect(await movimientos(variantId)).toMatchObject([
      { type: "ajuste", quantity: 12, stockAfter: 12 },
    ]);
  });

  test("un negativo escrito a mano es un error de tipeo, no una discrepancia", async () => {
    // RF-16. Que la columna acepte un total negativo (RF-24) es otra cosa:
    // ahí el negativo lo PRODUCE una venta ya ocurrida.
    const { variantId } = await unaVariante({ total: 3 });

    await expect(
      enTransaccion((tx) => ajustar(tx, { variantId, nuevoTotal: -1 })),
    ).rejects.toBeInstanceOf(TypeError);
  });
});

describe("lo que vale para las cinco", () => {
  test("la cantidad tiene que ser un entero positivo", async () => {
    const { variantId } = await unaVariante({ total: 10 });

    for (const cantidad of [0, -1, 1.5, Number.NaN]) {
      await expect(
        enTransaccion((tx) => reservar(tx, { variantId, quantity: cantidad })),
      ).rejects.toBeInstanceOf(TypeError);
    }
  });

  test("si la transacción se cae, el stock y el asiento se caen juntos", async () => {
    // §8.3 regla 1: todo o nada. Es la propiedad que hace que el libro mayor
    // signifique algo — un asiento que sobrevive a un cambio revertido es
    // peor que no tener libro.
    const { variantId } = await unaVariante({ total: 10 });

    await expect(
      enTransaccion(async (tx) => {
        await reservar(tx, { variantId, quantity: 4 });
        throw new Error("algo se rompió después de reservar");
      }),
    ).rejects.toThrow("algo se rompió después de reservar");

    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
    expect(await movimientos(variantId)).toHaveLength(0);
  });

  test("varias operaciones en una transacción dejan el libro en orden", async () => {
    const { variantId } = await unaVariante({ total: 10 });

    await enTransaccion(async (tx) => {
      await reservar(tx, { variantId, quantity: 5 });
      await liberar(tx, { variantId, quantity: 2 });
      await vender(tx, { variantId, quantity: 3 });
      await reponer(tx, { variantId, quantity: 1 });
    });

    expect(await contadores(variantId)).toEqual({
      stockTotal: 8,
      reservedStock: 0,
    });

    const libro = await movimientos(variantId);
    expect(libro.map((m) => [m.type, m.quantity])).toEqual([
      ["reserva", 5],
      ["liberacion", -2],
      ["venta", -3],
      ["devolucion", 1],
    ]);

    // Cada asiento guarda el estado que dejó, y el último tiene que ser el
    // estado actual. Es la comprobación que detecta un cambio hecho SIN
    // asentar, que es la falla que rompe la auditoría entera.
    expect(libro.at(-1)).toMatchObject({ stockAfter: 8, reservedAfter: 0 });
  });
});
