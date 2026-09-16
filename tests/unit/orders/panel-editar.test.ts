import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import { contadores, limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import {
  agregarAlCarrito,
  limpiarCompradores,
  unComprador,
  type Comprador,
} from "@/tests/apoyo/compradores";
import { historial, limpiarOrdenes } from "@/tests/apoyo/ordenes";

/**
 * F7.2 y F7.2a — Editar una orden activa desde el panel. RF-22 · TS §8.1.
 *
 * «Hecho cuando»: la vendedora quita renglones y baja cantidades desde la
 * interfaz y la reserva se libera de inmediato (F7.2); y sube cantidades y
 * agrega productos, reservando, sin poder pasarse del stock (F7.2a).
 *
 * **Lo que se prueba acá es la puerta, no la lógica.** Quitar y reducir ya
 * están probados contra Postgres en `editar.test.ts` desde F4.4 —la reserva,
 * el total, el historial, el `FOR UPDATE`—. Lo que F7.2 agrega y puede
 * romperse sin que nadie lo note es el envoltorio: que sólo entre la
 * administradora, que el número de la URL termine en la orden correcta, y que
 * el «quitar el último» siga exigiendo la confirmación explícita de RF-22
 * cuando el pedido llega por acá.
 *
 * La sesión se simula y la base es de verdad, por lo mismo que en
 * `mis-compras.test.ts`: armar una sesión real pediría GoTrue y cookies, y lo
 * que hay que verificar vive en Postgres.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

/** `refresh()` lanza fuera de una Server Action de verdad (precedente: F5.3). */
vi.mock("next/cache", () => ({ refresh: () => undefined }));

const {
  agregarItemALaOrden,
  aumentarCantidadDelItem,
  quitarItemDeLaOrden,
  reducirCantidadDelItem,
} = await import("@/modules/orders/actions-panel");
const { crearOrdenDesdeCarrito } = await import("@/modules/orders/crear");
const { finalizarOrden } = await import("@/modules/orders/estados");
const { leerOrdenDelPanel } = await import("@/modules/orders/queries-panel");

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

/**
 * Una orden con los renglones que se pidan, cada uno sobre su propia variante.
 * Devuelve el número —que es lo que viaja en la URL— y los ids de renglón.
 */
async function unaOrdenDe(
  comprador: Comprador,
  renglones: { stock: number; cantidad: number }[],
): Promise<{
  numero: number;
  orderId: string;
  variantes: string[];
  items: string[];
}> {
  const variantes: string[] = [];
  const esperado = [];

  for (const r of renglones) {
    const { variantId } = await unaVariante({ total: r.stock });
    variantes.push(variantId);
    await agregarAlCarrito(comprador.cartId, variantId, r.cantidad);
    esperado.push({ variantId, unitPrice: "1000.00", quantity: r.cantidad });
  }

  const { orderId, orderNumber } = await crearOrdenDesdeCarrito({
    userId: comprador.userId,
    idempotencyKey: randomUUID(),
    entrega: { tipo: "retiro" },
    customerName: "Rosa Pereyra",
    customerEmail: "rosa@ejemplo.test",
    customerPhone: "+5492920111111",
    esperado,
  });

  // Los renglones **emparejados con su variante**, no en el orden en que la
  // base los devuelva. `order_items.created_at` es el instante de la
  // transacción, así que los de una misma orden empatan y el desempate queda
  // en el UUID, que es azaroso: `items[0]` podía ser el renglón del otro
  // producto una vez cada dos corridas. Costó un test en rojo intermitente.
  const filas = [
    ...(await db.execute<{ id: string; variantId: string }>(sql`
      SELECT id, variant_id AS "variantId"
        FROM order_items WHERE order_id = ${orderId}`)),
  ];
  const items = variantes.map((v) => filas.find((f) => f.variantId === v)!.id);

  return { numero: orderNumber, orderId, variantes, items };
}

describe("quién puede editar", () => {
  test("sin sesión no se edita nada", async () => {
    const comprador = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    const r = await quitarItemDeLaOrden({
      numero: orden.numero,
      itemId: orden.items[0],
    });

    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
    // Y la reserva no se movió: el rechazo es antes de tocar nada.
    expect(await contadores(orden.variantes[0])).toMatchObject({
      reservedStock: 2,
    });
  });

  test("un comprador tampoco, aunque la orden sea suya", async () => {
    const comprador = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    comoSesion(comprador.userId, "customer");
    const r = await reducirCantidadDelItem({
      numero: orden.numero,
      itemId: orden.items[0],
      cantidad: 1,
    });

    // Editar la orden de otro es del panel: el comprador cancela la suya
    // entera (RF-23, F6.5) o no hace nada. No hay un término medio.
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("quitar un renglón (RF-22)", () => {
  test("libera la reserva, recalcula el total y queda quién lo hizo", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [
      { stock: 10, cantidad: 2 },
      { stock: 10, cantidad: 3 },
    ]);

    comoSesion(ana.userId, "admin");
    const r = await quitarItemDeLaOrden({
      numero: orden.numero,
      itemId: orden.items[0],
    });

    expect(r).toEqual({ ok: true, data: { ordenCancelada: false } });
    expect(await contadores(orden.variantes[0])).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
    // El otro renglón no se tocó.
    expect(await contadores(orden.variantes[1])).toMatchObject({
      reservedStock: 3,
    });

    const quedo = (await leerOrdenDelPanel(orden.numero))!;
    expect(quedo.items).toHaveLength(1);
    expect(quedo.total).toBe("3000.00");

    // RF-22 pide que el cambio quede registrado, y el autor es lo que
    // distingue esto de un arrepentimiento del comprador (RF-23).
    const filas = await historial(orden.orderId);
    expect(filas.at(-1)).toMatchObject({
      fromStatus: "activa",
      toStatus: "activa",
      actorUserId: ana.userId,
    });
  });

  test("el número de la URL tiene que llevar a SU orden", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const mia = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);
    const ajena = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 4 }]);

    comoSesion(ana.userId, "admin");

    // Un renglón que existe, pero de otra orden. Sin el `order_id` en el
    // WHERE de `editar.ts`, esto editaría la otra orden.
    const r = await quitarItemDeLaOrden({
      numero: mia.numero,
      itemId: ajena.items[0],
    });
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await contadores(ajena.variantes[0])).toMatchObject({
      reservedStock: 4,
    });

    // Y un número que no existe tampoco encuentra nada.
    const inventada = await quitarItemDeLaOrden({
      numero: 999_999_999,
      itemId: mia.items[0],
    });
    expect(inventada).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  test("quitar el único pide confirmación, y confirmando cancela la orden", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    comoSesion(ana.userId, "admin");

    // Sin la confirmación explícita de RF-22 no pasa nada, y se avisa por qué.
    const sinConfirmar = await quitarItemDeLaOrden({
      numero: orden.numero,
      itemId: orden.items[0],
    });
    expect(sinConfirmar).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(sinConfirmar).toMatchObject({
      details: { cancelaLaOrden: true },
    });
    expect(await contadores(orden.variantes[0])).toMatchObject({
      reservedStock: 2,
    });

    const confirmando = await quitarItemDeLaOrden({
      numero: orden.numero,
      itemId: orden.items[0],
      cancelarSiEsElUltimo: true,
    });
    expect(confirmando).toEqual({ ok: true, data: { ordenCancelada: true } });

    const quedo = (await leerOrdenDelPanel(orden.numero))!;
    expect(quedo.estado).toBe("cancelada");
    expect(quedo.items).toEqual([]);
    expect(quedo.total).toBe("0.00");
    // La reserva se soltó UNA vez, no dos: quitar el renglón y cancelar la
    // orden son dos pasos que podrían liberar lo mismo (`editar.ts`).
    expect(await contadores(orden.variantes[0])).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
  });
});

describe("bajar la cantidad (RF-22)", () => {
  test("libera sólo la diferencia", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 5 }]);

    comoSesion(ana.userId, "admin");
    const r = await reducirCantidadDelItem({
      numero: orden.numero,
      itemId: orden.items[0],
      cantidad: 2,
    });

    expect(r).toEqual({ ok: true, data: { cantidad: 2 } });
    expect(await contadores(orden.variantes[0])).toEqual({
      stockTotal: 10,
      reservedStock: 2,
    });

    const quedo = (await leerOrdenDelPanel(orden.numero))!;
    expect(quedo.items[0].cantidad).toBe(2);
    expect(quedo.total).toBe("2000.00");
    expect(quedo.unidades).toBe(2);
  });

  test("subir la cantidad no se puede desde acá", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    comoSesion(ana.userId, "admin");
    const r = await reducirCantidadDelItem({
      numero: orden.numero,
      itemId: orden.items[0],
      cantidad: 5,
    });

    // Agregar unidades habría que reservarlas, y puede no haber stock.
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await contadores(orden.variantes[0])).toMatchObject({
      reservedStock: 2,
    });
  });

  test("cero no es «bajar»: el esquema lo rechaza antes de llegar al dominio", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    comoSesion(ana.userId, "admin");
    // Bajar a cero es quitar, y quitar puede cancelar la orden: son dos
    // acciones con dos confirmaciones distintas, y colarse de una a la otra
    // por un cero sería cancelar sin preguntar.
    const r = await reducirCantidadDelItem({
      numero: orden.numero,
      itemId: orden.items[0],
      cantidad: 0,
    });
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await contadores(orden.variantes[0])).toMatchObject({
      reservedStock: 2,
    });
  });
});

describe("sólo las activas", () => {
  test("una finalizada no se edita, y el stock ya vendido no se toca", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 3 }]);

    await db.transaction((tx) =>
      finalizarOrden(tx, { orderId: orden.orderId }),
    );
    // Finalizar descontó el stock real y soltó la reserva (§8.1).
    expect(await contadores(orden.variantes[0])).toEqual({
      stockTotal: 7,
      reservedStock: 0,
    });

    comoSesion(ana.userId, "admin");
    const quitar = await quitarItemDeLaOrden({
      numero: orden.numero,
      itemId: orden.items[0],
    });
    const bajar = await reducirCantidadDelItem({
      numero: orden.numero,
      itemId: orden.items[0],
      cantidad: 1,
    });

    expect(quitar).toMatchObject({ ok: false, code: "INVALID_ORDER_STATE" });
    expect(bajar).toMatchObject({ ok: false, code: "INVALID_ORDER_STATE" });
    // Sin el `FOR UPDATE` de `editar.ts`, esto habría soltado una reserva que
    // la venta ya consumió y el libro dejaría de cuadrar.
    expect(await contadores(orden.variantes[0])).toEqual({
      stockTotal: 7,
      reservedStock: 0,
    });
  });
});

describe("el impacto en el stock que ve la pantalla", () => {
  test("cada renglón trae el disponible de hoy, y sube al soltar la reserva", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 4 }]);

    // 10 en la caja menos 4 reservadas por esta misma orden.
    const antes = (await leerOrdenDelPanel(orden.numero))!;
    expect(antes.items[0].disponible).toBe(6);

    comoSesion(ana.userId, "admin");
    await reducirCantidadDelItem({
      numero: orden.numero,
      itemId: orden.items[0],
      cantidad: 1,
    });

    // Es el número que el diálogo promete antes de confirmar: 6 → 9.
    const despues = (await leerOrdenDelPanel(orden.numero))!;
    expect(despues.items[0].disponible).toBe(9);
  });

  test("una variante borrada deja el renglón sin disponible, no en cero", async () => {
    const comprador = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    // §5.6: la variante se va y el snapshot sobrevive con `variant_id` NULL.
    await db.execute(sql`
      DELETE FROM product_variants WHERE id = ${orden.variantes[0]}`);

    const quedo = (await leerOrdenDelPanel(orden.numero))!;
    // Cero diría «no queda ninguna»; `null` dice «no hay contador que mover»,
    // que es lo que el diálogo tiene que explicar.
    expect(quedo.items[0].disponible).toBeNull();
    expect(quedo.items[0].nombre).toBeTruthy();
  });
});

describe("sumar desde el panel (RF-22, F7.2a)", () => {
  test("ni el anónimo ni el comprador suben nada", async () => {
    const comprador = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    expect(
      await aumentarCantidadDelItem({
        numero: orden.numero,
        itemId: orden.items[0],
        cantidad: 5,
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    // Ni siquiera sobre su propia orden: lo suyo es cancelarla entera (F6.5).
    comoSesion(comprador.userId, "customer");
    expect(
      await agregarItemALaOrden({
        numero: orden.numero,
        variantId: orden.variantes[0],
        cantidad: 1,
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    expect(await contadores(orden.variantes[0])).toMatchObject({
      reservedStock: 2,
    });
  });

  test("subir la cantidad reserva la diferencia", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    comoSesion(ana.userId, "admin");
    const r = await aumentarCantidadDelItem({
      numero: orden.numero,
      itemId: orden.items[0],
      cantidad: 5,
    });

    expect(r).toEqual({ ok: true, data: { cantidad: 5 } });
    expect(await contadores(orden.variantes[0])).toEqual({
      stockTotal: 10,
      reservedStock: 5,
    });
    // Y el disponible que va a ver el próximo diálogo bajó igual: 8 → 5.
    const quedo = (await leerOrdenDelPanel(orden.numero))!;
    expect(quedo.items[0].disponible).toBe(5);
  });

  test("agregar un producto que no estaba crea su renglón", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);
    const { variantId } = await unaVariante({ total: 4 });

    comoSesion(ana.userId, "admin");
    const r = await agregarItemALaOrden({
      numero: orden.numero,
      variantId,
      cantidad: 3,
    });

    expect(r).toEqual({
      ok: true,
      data: { sumadoAlRenglon: false, cantidad: 3 },
    });
    expect(await contadores(variantId)).toEqual({
      stockTotal: 4,
      reservedStock: 3,
    });
    expect((await leerOrdenDelPanel(orden.numero))!.items).toHaveLength(2);
  });

  test("agregar lo que ya está suma sobre su renglón", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);

    comoSesion(ana.userId, "admin");
    const r = await agregarItemALaOrden({
      numero: orden.numero,
      variantId: orden.variantes[0],
      cantidad: 2,
    });

    expect(r).toEqual({
      ok: true,
      data: { sumadoAlRenglon: true, cantidad: 4 },
    });
    const quedo = (await leerOrdenDelPanel(orden.numero))!;
    expect(quedo.items).toHaveLength(1);
    expect(quedo.items[0].cantidad).toBe(4);
  });

  test("sin stock no se suma, y el mensaje dice cuántas quedan", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    // 5 en total con 2 reservadas por esta orden: quedan 3.
    const orden = await unaOrdenDe(comprador, [{ stock: 5, cantidad: 2 }]);

    comoSesion(ana.userId, "admin");
    const r = await aumentarCantidadDelItem({
      numero: orden.numero,
      itemId: orden.items[0],
      cantidad: 9,
    });

    expect(r).toMatchObject({ ok: false, code: "INSUFFICIENT_STOCK" });
    if (r.ok) return;
    // Es la diferencia de fondo con la orden manual de RF-24, que advierte y
    // deja pasar: ahí la venta ya ocurrió, acá todavía no.
    expect(r.message).toContain("3 unidades");
    expect(await contadores(orden.variantes[0])).toMatchObject({
      reservedStock: 2,
    });
  });

  test("el número de la URL tiene que llevar a SU orden", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const mia = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);
    const ajena = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 4 }]);

    comoSesion(ana.userId, "admin");

    const cruzado = await aumentarCantidadDelItem({
      numero: mia.numero,
      itemId: ajena.items[0],
      cantidad: 6,
    });
    expect(cruzado).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await contadores(ajena.variantes[0])).toMatchObject({
      reservedStock: 4,
    });

    const inventada = await agregarItemALaOrden({
      numero: 999_999_999,
      variantId: mia.variantes[0],
      cantidad: 1,
    });
    expect(inventada).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  test("a una orden finalizada no se le suma (RF-13)", async () => {
    const comprador = await unComprador();
    const ana = await unComprador();
    const orden = await unaOrdenDe(comprador, [{ stock: 10, cantidad: 2 }]);
    await db.transaction((tx) =>
      finalizarOrden(tx, { orderId: orden.orderId }),
    );

    comoSesion(ana.userId, "admin");
    expect(
      await aumentarCantidadDelItem({
        numero: orden.numero,
        itemId: orden.items[0],
        cantidad: 3,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_ORDER_STATE" });
    expect(
      await agregarItemALaOrden({
        numero: orden.numero,
        variantId: orden.variantes[0],
        cantidad: 1,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_ORDER_STATE" });
  });
});
