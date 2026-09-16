import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { isDomainError } from "@/lib/errors";
import { crearOrdenManual } from "@/modules/orders/manual";
import { leerOrdenDelPanel } from "@/modules/orders/queries-panel";
import {
  contadores,
  limpiar,
  movimientos,
  unaVariante,
} from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import {
  estadoDeLaOrden,
  historial,
  limpiarOrdenes,
} from "@/tests/apoyo/ordenes";

/**
 * F7.4 — alta de una orden manual. RF-24 · TS §5.6, §8.1.
 *
 * «Hecho cuando»: productos con precio editable, comprador de texto libre,
 * envío o retiro, activa o finalizada, y advertir sin bloquear cuando la
 * cantidad supera el stock.
 *
 * **Acá se prueba el dominio**, que es donde está lo que puede romperse en
 * silencio: qué contador se mueve según cómo nace la orden, que el negativo
 * de §5.4 siga siendo posible, y que una orden que no se puede completar no
 * quede a medias. La puerta —el rol, la validación del formulario— va en
 * `panel-manual.test.ts`.
 */

/**
 * Las órdenes manuales sin cuenta no las borra `limpiarCompradores()` —no
 * cuelgan de ningún usuario— ni `limpiar()` —no cuelgan de ningún producto—,
 * así que se anotan acá y se borran al final. Sin esto, cada corrida deja
 * órdenes sueltas en la base local.
 */
const creadas: string[] = [];

async function crear(datos: Parameters<typeof crearOrdenManual>[0]) {
  const orden = await crearOrdenManual(datos);
  creadas.push(orden.orderId);
  return orden;
}

afterEach(async () => {
  for (const id of creadas.splice(0)) {
    await db.execute(sql`DELETE FROM orders WHERE id = ${id}`);
  }
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

/** Lo mínimo que pide una orden manual, para no repetirlo en cada test. */
function datosBase(items: Parameters<typeof crearOrdenManual>[0]["items"]) {
  return {
    creadaPor: null as unknown as string,
    userId: null,
    estado: "finalizada" as const,
    customerName: "Rosa Pereyra",
    customerEmail: null,
    customerPhone: "+5492920111111",
    direccion: null,
    notas: null,
    items,
  };
}

describe("cómo nace la orden (RF-24, §8.1)", () => {
  test("finalizada descuenta el stock real y no toca la reserva", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });

    const orden = await crear({
      ...datosBase([{ variantId, quantity: 3, unitPrice: "1500.00" }]),
      creadaPor: ana.userId,
      estado: "finalizada",
    });

    // La venta ya ocurrió: el stock baja y no hay reserva de por medio.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 7,
      reservedStock: 0,
    });

    const quedo = await estadoDeLaOrden(orden.orderId);
    expect(quedo.status).toBe("finalizada");
    expect(quedo.finalizedAt).not.toBeNull();

    // Un solo asiento, y del tipo que cuadra el libro mayor (§5.8).
    const asientos = await movimientos(variantId);
    expect(asientos).toHaveLength(1);
    expect(asientos[0]).toMatchObject({ type: "venta", quantity: -3 });
  });

  test("activa reserva y deja el stock real donde estaba", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });

    const orden = await crear({
      ...datosBase([{ variantId, quantity: 4, unitPrice: "1500.00" }]),
      creadaPor: ana.userId,
      estado: "activa",
    });

    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 4,
    });

    const quedo = await estadoDeLaOrden(orden.orderId);
    expect(quedo.status).toBe("activa");
    expect(quedo.finalizedAt).toBeNull();
  });

  test("el historial dice el estado en el que nació, sin inventarle un pasado", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });

    const orden = await crear({
      ...datosBase([{ variantId, quantity: 1, unitPrice: "1000.00" }]),
      creadaPor: ana.userId,
      estado: "finalizada",
    });

    // Una sola fila: la manual finalizada NUNCA estuvo activa, y escribir
    // `NULL → activa` + `activa → finalizada` sería contar algo que no pasó.
    const filas = await historial(orden.orderId);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      fromStatus: null,
      toStatus: "finalizada",
      actorUserId: ana.userId,
    });
  });
});

describe("lo que la vendedora escribe (RF-24)", () => {
  test("el precio es el acordado, no el del catálogo, y el total sale de ahí", async () => {
    const ana = await unComprador();
    // `unaVariante` cuelga de un producto de $1000 (apoyo de catálogo).
    const uno = await unaVariante({ total: 10 });
    const otro = await unaVariante({ total: 10 });

    const orden = await crear({
      ...datosBase([
        { variantId: uno.variantId, quantity: 2, unitPrice: "1500.50" },
        // Bonificado: RF-24 no pide un mínimo, y regalar un cable con la
        // venta es exactamente lo que se registra a mano.
        { variantId: otro.variantId, quantity: 1, unitPrice: "0.00" },
      ]),
      creadaPor: ana.userId,
    });

    const quedo = (await leerOrdenDelPanel(orden.orderNumber))!;
    expect(quedo.total).toBe("3001.00");
    expect(quedo.items.map((i) => i.precioUnitario).sort()).toEqual([
      "0.00",
      "1500.50",
    ]);
    // Y el snapshot del catálogo sí se copia: nombre, marca y color (RN-12).
    expect(quedo.items.every((i) => i.nombre.length > 0)).toBe(true);
  });

  test("la orden queda marcada como manual, con quién la cargó y sin cuenta", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    const orden = await crear({
      ...datosBase([{ variantId, quantity: 1, unitPrice: "1000.00" }]),
      creadaPor: ana.userId,
      customerName: "Alguien de la calle",
      customerEmail: null,
      customerPhone: "+5492920999999",
    });

    const [fila] = await db.execute<{
      origin: string;
      userId: string | null;
      createdBy: string | null;
      email: string | null;
    }>(sql`
      SELECT origin, user_id AS "userId", created_by AS "createdBy",
             customer_email AS email
        FROM orders WHERE id = ${orden.orderId}`);

    // `web_order_has_user` exige cuenta en las web y deja pasar éstas (§5.6).
    expect(fila).toMatchObject({
      origin: "manual",
      userId: null,
      createdBy: ana.userId,
      email: null,
    });

    const quedo = (await leerOrdenDelPanel(orden.orderNumber))!;
    expect(quedo.origen).toBe("manual");
    expect(quedo.cuenta).toBeNull();
  });

  test("con cuenta asociada, la orden es del comprador", async () => {
    const ana = await unComprador();
    const rosa = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    const orden = await crear({
      ...datosBase([{ variantId, quantity: 1, unitPrice: "1000.00" }]),
      creadaPor: ana.userId,
      userId: rosa.userId,
    });

    const quedo = (await leerOrdenDelPanel(orden.orderNumber))!;
    expect(quedo.cuenta?.id).toBe(rosa.userId);
  });

  test("el envío guarda la dirección y el retiro la deja en nulo", async () => {
    const ana = await unComprador();
    const uno = await unaVariante({ total: 5 });
    const otro = await unaVariante({ total: 5 });

    const conEnvio = await crear({
      ...datosBase([
        { variantId: uno.variantId, quantity: 1, unitPrice: "1000.00" },
      ]),
      creadaPor: ana.userId,
      direccion: {
        recipientName: "Rosa Pereyra",
        phone: "+5492920111111",
        street: "Av. Siempreviva",
        number: "742",
        apartment: null,
        notes: null,
        city: "Viedma",
        province: "Río Negro",
        postalCode: "8500",
      },
    });

    const conRetiro = await crear({
      ...datosBase([
        { variantId: otro.variantId, quantity: 1, unitPrice: "1000.00" },
      ]),
      creadaPor: ana.userId,
    });

    // Sin columna de forma de entrega: la dirección ES el dato (§5.6).
    const envio = (await leerOrdenDelPanel(conEnvio.orderNumber))!;
    expect(envio.shippingAddress?.city).toBe("Viedma");
    const retiro = (await leerOrdenDelPanel(conRetiro.orderNumber))!;
    expect(retiro.shippingAddress).toBeNull();
  });
});

describe("el stock que no alcanza (RF-24, §5.4)", () => {
  test("finalizada puede dejar el total en negativo: es la discrepancia", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 2 });

    // Vendió 5 de las que el sistema creía tener 2. Bloquearlo obligaría a
    // mentirle al sistema; el −3 es la señal que el panel destaca.
    const orden = await crear({
      ...datosBase([{ variantId, quantity: 5, unitPrice: "1000.00" }]),
      creadaPor: ana.userId,
      estado: "finalizada",
    });

    expect(await contadores(variantId)).toEqual({
      stockTotal: -3,
      reservedStock: 0,
    });
    expect((await leerOrdenDelPanel(orden.orderNumber))!.estado).toBe(
      "finalizada",
    );
  });

  test("activa no reserva lo que no existe, y lo explica", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 2 });

    const error = await crearOrdenManual({
      ...datosBase([{ variantId, quantity: 5, unitPrice: "1000.00" }]),
      creadaPor: ana.userId,
      estado: "activa",
    }).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("INSUFFICIENT_STOCK");
    // Las dos salidas reales, en el mensaje: no es un «no se puede» a secas.
    expect(String((error as Error).message)).toContain(
      "cargala como finalizada",
    );

    // Y la orden no quedó a medias: todo o nada (§8.3 regla 1).
    expect(await contadores(variantId)).toEqual({
      stockTotal: 2,
      reservedStock: 0,
    });
    const [conteo] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM orders WHERE origin = 'manual'
         AND customer_phone = '+5492920111111'`);
    expect(conteo.n).toBe(0);
  });

  test("finalizada tampoco puede dejar comprometido lo que ya no está", async () => {
    const ana = await unComprador();
    // 5 en total con 3 reservadas por órdenes activas: vender 3 dejaría 2
    // con 3 comprometidas, que es el estado que `reserved_within_total`
    // prohíbe mientras el total no sea negativo (§5.4).
    const { variantId } = await unaVariante({ total: 5, reservado: 3 });

    const error = await crearOrdenManual({
      ...datosBase([{ variantId, quantity: 3, unitPrice: "1000.00" }]),
      creadaPor: ana.userId,
      estado: "finalizada",
    }).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("INSUFFICIENT_STOCK");
    expect(String((error as Error).message)).toContain("órdenes activas");
    expect(await contadores(variantId)).toEqual({
      stockTotal: 5,
      reservedStock: 3,
    });
  });
});

describe("lo que no se puede cargar", () => {
  test("sin renglones no hay orden", async () => {
    const ana = await unComprador();
    const error = await crearOrdenManual({
      ...datosBase([]),
      creadaPor: ana.userId,
    }).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("VALIDATION");
  });

  test("una variante que ya no está en el catálogo corta todo", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });

    const error = await crearOrdenManual({
      ...datosBase([
        { variantId, quantity: 1, unitPrice: "1000.00" },
        {
          variantId: "00000000-0000-0000-0000-000000000000",
          quantity: 1,
          unitPrice: "1000.00",
        },
      ]),
      creadaPor: ana.userId,
    }).catch((e: unknown) => e);

    expect(isDomainError(error) && error.code).toBe("NOT_FOUND");
    // El renglón que sí existía tampoco se movió.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
  });
});
