import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import {
  contadores,
  limpiar,
  movimientos,
  unaVariante,
} from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import {
  limpiarOrdenes,
  renglonesDeLaOrden,
  unaOrdenActiva,
} from "@/tests/apoyo/ordenes";

/**
 * F7.5 — Devoluciones en el panel. RF-25 · TS §5.7, §8.1.
 *
 * «Hecho cuando»: selección de ítems, cantidades y si repone stock, con motivo.
 *
 * **La puerta y no la lógica.** El dominio está probado contra Postgres en
 * `registrar.test.ts` desde F4.5: el tope de «ni más de lo vendido ni de lo ya
 * devuelto» con la orden bloqueada, la reposición, la anulación que revierte y
 * libera el cupo. Lo que F7.5 agrega y puede romperse sin que nadie lo note es
 * el envoltorio: que sólo entre la administradora, que el número de la URL
 * lleve a la orden correcta, que el motivo obligatorio lo sea de verdad, y que
 * un motivo de renglón no quede guardado contra un producto que sí volvió al
 * stock.
 *
 * Y las lecturas de la pantalla, que son nuevas: lo ya devuelto por renglón
 * —que es el tope que el diálogo ofrece— y los filtros del listado.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

/** `refresh()` lanza fuera de una Server Action de verdad (precedente: F5.3). */
vi.mock("next/cache", () => ({ refresh: () => undefined }));

const { anularUnaDevolucion, registrarUnaDevolucion } =
  await import("@/modules/returns/actions");
const { devolucionesDeLaOrden, devueltasPorRenglon, listarDevoluciones } =
  await import("@/modules/returns/queries");
const { FILTROS_VACIOS } = await import("@/modules/returns/filtros");
const { finalizarOrden } = await import("@/modules/orders/estados");

function comoSesion(userId: string, role: "admin" | "customer") {
  sesion.actual = {
    identity: { userId, email: "ana@ejemplo.test", emailVerified: true },
    role,
    profile: {
      id: userId,
      email: "ana@ejemplo.test",
      isBanned: false,
      banReason: null,
      closureRequestedAt: null,
    },
  };
}

afterEach(async () => {
  sesion.actual = null;
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

/** El número de la orden, que es lo que viaja en la URL del panel. */
async function numeroDe(orderId: string): Promise<number> {
  const [fila] = await db.execute<{ numero: number }>(sql`
    SELECT order_number AS numero FROM orders WHERE id = ${orderId}`);
  return fila.numero;
}

type OrdenDePrueba = {
  orderId: string;
  numero: number;
  items: { orderItemId: string; variantId: string }[];
};

/**
 * Una orden **finalizada** con uno o más renglones: es la única sobre la que
 * se devuelve. Cada renglón nace con `total` en stock y `cantidad` vendidas,
 * así que después de la venta quedan `total − cantidad`.
 */
async function ordenVendida(
  renglones: readonly { total: number; cantidad: number }[] = [
    { total: 10, cantidad: 4 },
  ],
): Promise<OrdenDePrueba> {
  const variantes = await Promise.all(
    renglones.map((r) =>
      unaVariante({ total: r.total, reservado: r.cantidad }),
    ),
  );

  const { orderId } = await unaOrdenActiva(
    variantes.map((v, i) => ({
      variantId: v.variantId,
      quantity: renglones[i].cantidad,
    })),
  );
  await db.transaction((tx) => finalizarOrden(tx, { orderId }));

  const filas = await renglonesDeLaOrden(orderId);
  return {
    orderId,
    numero: await numeroDe(orderId),
    // Por `variantId`, porque `renglonesDeLaOrden` ordena por fecha de alta y
    // acá hace falta saber cuál es cuál.
    items: variantes.map((v) => ({
      variantId: v.variantId,
      orderItemId: filas.find((f) => f.variantId === v.variantId)!.id,
    })),
  };
}

describe("quién puede devolver", () => {
  test("sin sesión no se registra ninguna devolución", async () => {
    const orden = await ordenVendida();

    expect(
      await registrarUnaDevolucion({
        numero: orden.numero,
        motivo: "Se arrepintió",
        items: [
          { itemId: orden.items[0].orderItemId, cantidad: 1, repone: true },
        ],
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    // El rechazo es antes de tocar nada: 10 − 4 vendidas siguen siendo 6.
    expect(await contadores(orden.items[0].variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });
  });

  test("el comprador no registra devoluciones, ni de su propia orden", async () => {
    const comprador = await unComprador();
    const orden = await ordenVendida();

    comoSesion(comprador.userId, "customer");

    // FA-15: las devoluciones las registra la administradora. Lo del
    // comprador es cancelar mientras la orden esté activa (RF-23).
    expect(
      await registrarUnaDevolucion({
        numero: orden.numero,
        motivo: "Se arrepintió",
        items: [
          { itemId: orden.items[0].orderItemId, cantidad: 1, repone: true },
        ],
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  test("un número de orden que no existe no encuentra nada", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(
      await registrarUnaDevolucion({
        numero: 999_999_999,
        motivo: "Se arrepintió",
        items: [
          {
            itemId: "00000000-0000-0000-0000-000000000000",
            cantidad: 1,
            repone: true,
          },
        ],
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("registrar (RF-25)", () => {
  test("con reposición suma al stock y deja quién fue", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida();

    comoSesion(ana.userId, "admin");
    const r = await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Le quedaba chico",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 3, repone: true },
      ],
    });

    expect(r.ok).toBe(true);

    // 10 − 4 vendidas = 6, y vuelven 3.
    expect(await contadores(orden.items[0].variantId)).toEqual({
      stockTotal: 9,
      reservedStock: 0,
    });

    const [devolucion] = await devolucionesDeLaOrden(orden.numero);
    expect(devolucion).toMatchObject({
      estado: "registrada",
      motivo: "Le quedaba chico",
      unidades: 3,
      // 3 unidades al precio del renglón (`unaOrdenActiva` vende a 1000).
      monto: "3000.00",
    });
    // RF-25 pide saber quién la registró: es el perfil de la sesión.
    expect(devolucion.autor).not.toBeNull();
    expect(devolucion.items).toEqual([
      expect.objectContaining({ cantidad: 3, repone: true, motivo: null }),
    ]);
  });

  test("sin reposición no toca el stock y guarda el motivo del renglón", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida();

    comoSesion(ana.userId, "admin");
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Vino fallado",
      items: [
        {
          itemId: orden.items[0].orderItemId,
          cantidad: 2,
          repone: false,
          motivo: "Llegó con la pantalla rota",
        },
      ],
    });

    // El producto volvió roto: no hay nada que vender (§8.1).
    expect(await contadores(orden.items[0].variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });
    expect(await movimientos(orden.items[0].variantId)).toHaveLength(1);

    const [devolucion] = await devolucionesDeLaOrden(orden.numero);
    expect(devolucion.items[0]).toMatchObject({
      repone: false,
      motivo: "Llegó con la pantalla rota",
    });
  });

  test("lo que repone no guarda motivo de renglón, aunque venga uno", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida();

    comoSesion(ana.userId, "admin");
    // La pantalla esconde ese campo al marcar «vuelve al stock», pero el texto
    // pudo quedar escrito de antes: guardarlo dejaría en la base la
    // explicación de algo que no pasó.
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Se arrepintió",
      items: [
        {
          itemId: orden.items[0].orderItemId,
          cantidad: 1,
          repone: true,
          motivo: "Llegó con la pantalla rota",
        },
      ],
    });

    const [devolucion] = await devolucionesDeLaOrden(orden.numero);
    expect(devolucion.items[0]).toMatchObject({ repone: true, motivo: null });
  });

  test("una devolución mezcla renglones que reponen y renglones que no", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida([
      { total: 10, cantidad: 4 },
      { total: 5, cantidad: 2 },
    ]);

    comoSesion(ana.userId, "admin");
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Devolvió las dos cosas",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 2, repone: true },
        { itemId: orden.items[1].orderItemId, cantidad: 1, repone: false },
      ],
    });

    // El primero vuelve a la góndola; el segundo se descarta.
    expect(await contadores(orden.items[0].variantId)).toEqual({
      stockTotal: 8,
      reservedStock: 0,
    });
    expect(await contadores(orden.items[1].variantId)).toEqual({
      stockTotal: 3,
      reservedStock: 0,
    });
  });

  test("el motivo general es obligatorio", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida();

    comoSesion(ana.userId, "admin");
    // `returns.reason` es NOT NULL: sin el esquema, esto sería un error de
    // Postgres traducido a «no pudimos completar la acción».
    const r = await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "   ",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 1, repone: true },
      ],
    });

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await devolucionesDeLaOrden(orden.numero)).toHaveLength(0);
  });

  test("sin ningún renglón elegido no hay devolución", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida();

    comoSesion(ana.userId, "admin");
    expect(
      await registrarUnaDevolucion({
        numero: orden.numero,
        motivo: "Se arrepintió",
        items: [],
      }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  test("sobre una orden activa no se devuelve: se edita o se cancela", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 10, reservado: 4 });
    const { orderId } = await unaOrdenActiva([{ variantId, quantity: 4 }]);
    const [renglon] = await renglonesDeLaOrden(orderId);

    comoSesion(ana.userId, "admin");
    expect(
      await registrarUnaDevolucion({
        numero: await numeroDe(orderId),
        motivo: "Se arrepintió",
        items: [{ itemId: renglon.id, cantidad: 1, repone: true }],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_ORDER_STATE" });
  });

  test("no se devuelve más de lo vendido, y no queda nada a medias", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida([{ total: 10, cantidad: 4 }]);

    comoSesion(ana.userId, "admin");
    const r = await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Devolvió de más",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 5, repone: true },
      ],
    });

    expect(r).toMatchObject({ ok: false, code: "RETURN_EXCEEDS_SOLD" });
    // El mensaje dice cuántas se vendieron, que es lo que la pantalla muestra.
    expect(r).toMatchObject({ message: expect.stringContaining("4") });
    expect(await contadores(orden.items[0].variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });
    expect(await devolucionesDeLaOrden(orden.numero)).toHaveLength(0);
  });

  test("dos devoluciones parciales suman contra el mismo tope", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida([{ total: 10, cantidad: 4 }]);

    comoSesion(ana.userId, "admin");
    const devolver = (cantidad: number) =>
      registrarUnaDevolucion({
        numero: orden.numero,
        motivo: "De a poco",
        items: [{ itemId: orden.items[0].orderItemId, cantidad, repone: true }],
      });

    expect(await devolver(3)).toMatchObject({ ok: true });
    // Quedaba una: pedir dos se pasa del tope.
    expect(await devolver(2)).toMatchObject({
      ok: false,
      code: "RETURN_EXCEEDS_SOLD",
    });
    expect(await devolver(1)).toMatchObject({ ok: true });
  });
});

describe("anular (RF-25)", () => {
  test("revierte lo repuesto, guarda el motivo y libera el cupo", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida([{ total: 10, cantidad: 4 }]);

    comoSesion(ana.userId, "admin");
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Me confundí de producto",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 4, repone: true },
      ],
    });
    const [devolucion] = await devolucionesDeLaOrden(orden.numero);

    const r = await anularUnaDevolucion({
      returnId: devolucion.id,
      motivo: "Era de otra orden",
    });
    expect(r).toMatchObject({ ok: true });

    // Vuelve a 6: la reposición sale del stock.
    expect(await contadores(orden.items[0].variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });

    const [anulada] = await devolucionesDeLaOrden(orden.numero);
    expect(anulada).toMatchObject({
      estado: "anulada",
      motivoDeAnulacion: "Era de otra orden",
    });
    expect(anulada.anuladaEn).not.toBeNull();

    // El cupo quedó libre: se vuelve a cargar entera, que es lo que RF-25
    // quiere al decir «se anula y se vuelve a cargar».
    expect(
      await registrarUnaDevolucion({
        numero: orden.numero,
        motivo: "Ahora sí",
        items: [
          { itemId: orden.items[0].orderItemId, cantidad: 4, repone: true },
        ],
      }),
    ).toMatchObject({ ok: true });
  });

  test("una anulada no se vuelve a anular", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida();

    comoSesion(ana.userId, "admin");
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Se arrepintió",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 1, repone: true },
      ],
    });
    const [devolucion] = await devolucionesDeLaOrden(orden.numero);

    expect(
      await anularUnaDevolucion({ returnId: devolucion.id, motivo: "Error" }),
    ).toMatchObject({ ok: true });

    // Dos pestañas abiertas, o dos clics: el stock no sale dos veces.
    expect(
      await anularUnaDevolucion({ returnId: devolucion.id, motivo: "Error" }),
    ).toMatchObject({ ok: false, code: "INVALID_ORDER_STATE" });

    expect(await contadores(orden.items[0].variantId)).toEqual({
      stockTotal: 6,
      reservedStock: 0,
    });
  });

  test("el motivo de la anulación es obligatorio, y sin sesión no se anula", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida();

    comoSesion(ana.userId, "admin");
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Se arrepintió",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 1, repone: true },
      ],
    });
    const [devolucion] = await devolucionesDeLaOrden(orden.numero);

    expect(
      await anularUnaDevolucion({ returnId: devolucion.id, motivo: "  " }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });

    sesion.actual = null;
    expect(
      await anularUnaDevolucion({ returnId: devolucion.id, motivo: "Error" }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    // Sigue registrada: ninguno de los dos rechazos la tocó.
    expect((await devolucionesDeLaOrden(orden.numero))[0].estado).toBe(
      "registrada",
    );
  });
});

describe("lo que la pantalla lee", () => {
  test("lo ya devuelto por renglón no cuenta las anuladas", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida([{ total: 10, cantidad: 4 }]);
    const itemId = orden.items[0].orderItemId;

    comoSesion(ana.userId, "admin");
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Una",
      items: [{ itemId, cantidad: 1, repone: true }],
    });
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Otra",
      items: [{ itemId, cantidad: 2, repone: true }],
    });

    const devoluciones = await devolucionesDeLaOrden(orden.numero);
    expect(devueltasPorRenglon(devoluciones).get(itemId)).toBe(3);

    // Anular la de dos deja el tope en una sola devuelta, que es el mismo
    // criterio que usa el dominio (`status = 'registrada'`).
    const laDeDos = devoluciones.find((d) => d.unidades === 2)!;
    await anularUnaDevolucion({ returnId: laDeDos.id, motivo: "Error" });

    expect(
      devueltasPorRenglon(await devolucionesDeLaOrden(orden.numero)).get(
        itemId,
      ),
    ).toBe(1);
  });

  test("el listado filtra por reposición y por estado", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida([
      { total: 10, cantidad: 4 },
      { total: 5, cantidad: 2 },
    ]);

    comoSesion(ana.userId, "admin");
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Vuelve al stock",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 1, repone: true },
      ],
    });
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "Rota",
      items: [
        { itemId: orden.items[1].orderItemId, cantidad: 1, repone: false },
      ],
    });

    // **Sólo las de esta orden.** El listado no filtra por orden —no tiene
    // por qué—, y la base de pruebas arrastra devoluciones de corridas
    // anteriores: un test que mire el total global afirmaría algo sobre la
    // máquina de quien lo corre y no sobre el código.
    const deEstaOrden = async (filtros: Partial<typeof FILTROS_VACIOS> = {}) =>
      (await listarDevoluciones({ ...FILTROS_VACIOS, ...filtros })).devoluciones
        .filter((d) => d.numero === orden.numero)
        .map((d) => d.motivo);

    const todas = await listarDevoluciones(FILTROS_VACIOS);
    const mias = todas.devoluciones.filter((d) => d.numero === orden.numero);
    expect(mias).toHaveLength(2);
    // La orden y el comprador viajan con cada fila: RF-25 los pide en el
    // listado.
    expect(mias[0]).toMatchObject({
      numero: orden.numero,
      customerName: "Cliente de prueba",
    });

    expect(await deEstaOrden({ reposicion: "con" })).toEqual([
      "Vuelve al stock",
    ]);
    expect(await deEstaOrden({ reposicion: "sin" })).toEqual(["Rota"]);

    const laQueRepone = mias.find((d) => d.motivo === "Vuelve al stock")!;
    await anularUnaDevolucion({ returnId: laQueRepone.id, motivo: "Error" });

    expect(await deEstaOrden({ estado: "registradas" })).toEqual(["Rota"]);
    expect(await deEstaOrden({ estado: "anuladas" })).toEqual([
      "Vuelve al stock",
    ]);
  });

  test("el rango de fechas deja afuera lo que no entra", async () => {
    const ana = await unComprador();
    const orden = await ordenVendida();

    comoSesion(ana.userId, "admin");
    await registrarUnaDevolucion({
      numero: orden.numero,
      motivo: "De hoy",
      items: [
        { itemId: orden.items[0].orderItemId, cantidad: 1, repone: true },
      ],
    });

    const hoy = new Date().toISOString().slice(0, 10);
    const enElRango = async (desde: string, hasta: string) =>
      (
        await listarDevoluciones({ ...FILTROS_VACIOS, desde, hasta })
      ).devoluciones.filter((d) => d.numero === orden.numero);

    // El día de `hasta` entra entero: sin eso, una devolución de las 22:00 se
    // perdería en su propio día.
    expect(await enElRango(hoy, hoy)).toHaveLength(1);
    expect(await enElRango("2020-01-01", "2020-01-31")).toHaveLength(0);
  });
});
