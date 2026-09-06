import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { DomainError } from "@/lib/errors";
import {
  crearOrdenDesdeCarrito,
  type DatosDeCompra,
} from "@/modules/orders/crear";
import {
  contadores,
  limpiar,
  movimientos,
  unaVariante,
} from "@/tests/apoyo/catalogo";
import {
  agregarAlCarrito,
  itemsDeLaOrden,
  itemsEnElCarrito,
  laOrden,
  limpiarCompradores,
  unComprador,
  type Comprador,
} from "@/tests/apoyo/compradores";
import { dosCompitiendo } from "@/tests/apoyo/concurrencia";
import { historial, limpiarOrdenes } from "@/tests/apoyo/ordenes";

/**
 * F4.3 — creación de orden desde el carrito. RF-11, RF-12 · §8.4, §8.5.
 *
 * «Hecho cuando»: el procedimiento de §8.4 completo, y dos envíos con la misma
 * clave devuelven LA MISMA orden.
 */

afterEach(async () => {
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

function compra(
  comprador: Comprador,
  esperado: DatosDeCompra["esperado"],
  clave = randomUUID(),
): DatosDeCompra {
  return {
    userId: comprador.userId,
    idempotencyKey: clave,
    addressId: comprador.addressId,
    customerName: "Compradora de prueba",
    customerEmail: "compradora@ejemplo.test",
    customerPhone: "+5491155550000",
    esperado,
  };
}

/** El precio final del producto de una variante, tal como lo ve la tienda. */
async function ponerPrecio(
  variantId: string,
  precio: string,
  descuento = "0.00",
): Promise<void> {
  await db.execute(sql`
    UPDATE products SET price = ${precio}, discount = ${descuento}
     WHERE id = (SELECT product_id FROM product_variants WHERE id = ${variantId})`);
}

describe("el camino que tiene que funcionar", () => {
  test("crea la orden activa, reserva, cobra el total y vacía el carrito", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });
    await ponerPrecio(variantId, "1500.00", "500.00"); // final: 1000.00
    await agregarAlCarrito(comprador.cartId, variantId, 3);

    const resultado = await crearOrdenDesdeCarrito(
      compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
    );

    expect(resultado.yaExistia).toBe(false);
    // Los números de orden arrancan en 1000 para no parecer la orden n.º 1.
    expect(resultado.orderNumber).toBeGreaterThanOrEqual(1000);

    const orden = await laOrden(resultado.orderId);
    expect(orden.status).toBe("activa");
    expect(orden.origin).toBe("web");
    expect(orden.total).toBe("3000.00");

    // La reserva quedó puesta y el stock real no se tocó (RN-07).
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 3,
    });
    expect(await movimientos(variantId)).toMatchObject([
      { type: "reserva", quantity: 3, stockAfter: 10, reservedAfter: 3 },
    ]);

    expect(await itemsEnElCarrito(comprador.cartId)).toBe(0);
    expect(await historial(resultado.orderId)).toMatchObject([
      { fromStatus: null, toStatus: "activa" },
    ]);
  });

  test("guarda el snapshot del comprador y de la dirección (RN-12)", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregarAlCarrito(comprador.cartId, variantId, 1);

    const { orderId } = await crearOrdenDesdeCarrito(
      compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
    );

    const orden = await laOrden(orderId);
    expect(orden.customerName).toBe("Compradora de prueba");
    expect(orden.customerPhone).toBe("+5491155550000");
    expect(orden.shippingAddress).toMatchObject({
      street: "Av. Siempreviva",
      number: "742",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "S2000",
    });
  });

  test("el ítem guarda nombre, marca y precio, y sobrevive al catálogo", async () => {
    const comprador = await unComprador();
    const { variantId, productId } = await unaVariante({ total: 5 });
    await agregarAlCarrito(comprador.cartId, variantId, 2);

    const { orderId } = await crearOrdenDesdeCarrito(
      compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
    );

    // Todo el catálogo cambia después de la compra.
    await db.execute(sql`
      UPDATE products SET name = 'Otro nombre', price = '99999.00'
       WHERE id = ${productId}`);

    const [item] = await itemsDeLaOrden(orderId);
    expect(item).toMatchObject({
      unitPrice: "1000.00",
      quantity: 2,
      subtotal: "2000.00",
    });
    // El nombre y el precio son los de cuando compró, no los de ahora.
    expect(item.productName).not.toBe("Otro nombre");
    expect((await laOrden(orderId)).total).toBe("2000.00");
  });

  test("el total se suma en SQL y no pierde centavos", async () => {
    const comprador = await unComprador();
    const a = await unaVariante({ total: 10 });
    const b = await unaVariante({ total: 10 });
    await ponerPrecio(a.variantId, "1010.10");
    await ponerPrecio(b.variantId, "20.05");
    await agregarAlCarrito(comprador.cartId, a.variantId, 3);
    await agregarAlCarrito(comprador.cartId, b.variantId, 7);

    const { orderId } = await crearOrdenDesdeCarrito(
      compra(comprador, [
        { variantId: a.variantId, unitPrice: "1010.10" },
        { variantId: b.variantId, unitPrice: "20.05" },
      ]),
    );

    // 3030.30 + 140.35
    expect((await laOrden(orderId)).total).toBe("3170.65");
  });
});

describe("idempotencia (§8.5)", () => {
  test("dos envíos con la misma clave devuelven LA MISMA orden", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, variantId, 2);

    const clave = randomUUID();
    const datos = compra(comprador, [{ variantId, unitPrice: "1000.00" }], clave);

    const primera = await crearOrdenDesdeCarrito(datos);
    const segunda = await crearOrdenDesdeCarrito(datos);

    expect(segunda.orderId).toBe(primera.orderId);
    expect(segunda.orderNumber).toBe(primera.orderNumber);
    expect(segunda.yaExistia).toBe(true);

    // Y sobre todo: se reservó UNA vez. Es el punto entero de la clave.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 2,
    });
    expect(await movimientos(variantId)).toHaveLength(1);
  });

  test("dos claves distintas sí son dos órdenes", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, variantId, 2);

    const primera = await crearOrdenDesdeCarrito(
      compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
    );

    // El carrito quedó vacío, así que hay que volver a llenarlo: es lo que
    // haría alguien comprando dos veces.
    await agregarAlCarrito(comprador.cartId, variantId, 1);
    const segunda = await crearOrdenDesdeCarrito(
      compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
    );

    expect(segunda.orderId).not.toBe(primera.orderId);
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 3,
    });
  });

  test("la clave se guarda en la orden", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregarAlCarrito(comprador.cartId, variantId, 1);

    const clave = randomUUID();
    const { orderId } = await crearOrdenDesdeCarrito(
      compra(comprador, [{ variantId, unitPrice: "1000.00" }], clave),
    );

    expect((await laOrden(orderId)).idempotencyKey).toBe(clave);
  });
});

describe("reconfirmación: lo que cambió mientras miraba (§8.4 paso 3)", () => {
  test("el precio subió: PRICE_CHANGED con los dos números", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, variantId, 1);
    await ponerPrecio(variantId, "1200.00");

    const fallo = (await crearOrdenDesdeCarrito(
      compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
    ).catch((e: unknown) => e)) as DomainError;

    expect(fallo).toBeInstanceOf(DomainError);
    expect(fallo.code).toBe("PRICE_CHANGED");
    expect(fallo.details).toMatchObject({
      items: [{ variantId, precioVisto: "1000.00", precioVigente: "1200.00" }],
    });

    // Nada creado, nada reservado, y el carrito intacto: la persona vuelve a
    // la pantalla y sigue teniendo su compra armada.
    expect(await contadores(variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
    expect(await itemsEnElCarrito(comprador.cartId)).toBe(1);
  });

  test("un descuento nuevo también es un cambio, aunque sea a favor", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, variantId, 1);
    await ponerPrecio(variantId, "1000.00", "300.00"); // final: 700.00

    await expect(
      crearOrdenDesdeCarrito(
        compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
      ),
    ).rejects.toMatchObject({ code: "PRICE_CHANGED" });
  });

  test("el producto se desactivó: PRODUCT_UNAVAILABLE, y pesa más que el precio", async () => {
    const comprador = await unComprador();
    const caro = await unaVariante({ total: 10 });
    const muerto = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, caro.variantId, 1);
    await agregarAlCarrito(comprador.cartId, muerto.variantId, 1);

    await ponerPrecio(caro.variantId, "9999.00");
    await db.execute(sql`
      UPDATE products SET is_active = false WHERE id = ${muerto.productId}`);

    const fallo = (await crearOrdenDesdeCarrito(
      compra(comprador, [
        { variantId: caro.variantId, unitPrice: "1000.00" },
        { variantId: muerto.variantId, unitPrice: "1000.00" },
      ]),
    ).catch((e: unknown) => e)) as DomainError;

    // Hay dos problemas y se avisa del que hay que resolver primero: algo que
    // ya no se vende. Avisar del precio de otra cosa antes mandaría a la
    // persona por el camino largo.
    expect(fallo.code).toBe("PRODUCT_UNAVAILABLE");
    expect(fallo.details).toMatchObject({
      items: [{ variantId: muerto.variantId }],
    });
  });

  test("la variante se desactivó, aunque el producto siga activo", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, variantId, 1);
    await db.execute(sql`
      UPDATE product_variants SET is_active = false WHERE id = ${variantId}`);

    await expect(
      crearOrdenDesdeCarrito(
        compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
      ),
    ).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  });

  test("apareció algo en el carrito que nunca vio, desde otra pestaña", async () => {
    const comprador = await unComprador();
    const visto = await unaVariante({ total: 10 });
    const colado = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, visto.variantId, 1);
    await agregarAlCarrito(comprador.cartId, colado.variantId, 1);

    const fallo = (await crearOrdenDesdeCarrito(
      compra(comprador, [{ variantId: visto.variantId, unitPrice: "1000.00" }]),
    ).catch((e: unknown) => e)) as DomainError;

    // Confirmar así le cobraría algo que nunca estuvo en su resumen.
    expect(fallo.code).toBe("PRICE_CHANGED");
    expect(fallo.details).toMatchObject({ agregados: [colado.variantId] });
    expect(await contadores(visto.variantId)).toEqual({
      stockTotal: 10,
      reservedStock: 0,
    });
  });

  test("desapareció del carrito algo que sí vio", async () => {
    const comprador = await unComprador();
    const queda = await unaVariante({ total: 10 });
    const fue = await unaVariante({ total: 10 });
    await agregarAlCarrito(comprador.cartId, queda.variantId, 1);

    const fallo = (await crearOrdenDesdeCarrito(
      compra(comprador, [
        { variantId: queda.variantId, unitPrice: "1000.00" },
        { variantId: fue.variantId, unitPrice: "1000.00" },
      ]),
    ).catch((e: unknown) => e)) as DomainError;

    expect(fallo.code).toBe("PRICE_CHANGED");
    expect(fallo.details).toMatchObject({ quitados: [fue.variantId] });
  });
});

describe("lo que impide crear la orden", () => {
  test("sin stock suficiente: INSUFFICIENT_STOCK y no queda nada", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 5, reservado: 4 });
    await agregarAlCarrito(comprador.cartId, variantId, 3);

    await expect(
      crearOrdenDesdeCarrito(
        compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    // Todo o nada (§8.3 regla 1): ni orden, ni ítems, ni asiento, ni carrito
    // vaciado. Vaciar el carrito de una compra que no se hizo sería la peor
    // versión de este error.
    const [{ n }] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM orders WHERE user_id = ${comprador.userId}`);
    expect(n).toBe(0);
    expect(await movimientos(variantId)).toHaveLength(0);
    expect(await itemsEnElCarrito(comprador.cartId)).toBe(1);
  });

  test("si un ítem no entra, tampoco entra el que sí tenía stock", async () => {
    const comprador = await unComprador();
    const hay = await unaVariante({ total: 50 });
    const nohay = await unaVariante({ total: 1 });
    await agregarAlCarrito(comprador.cartId, hay.variantId, 2);
    await agregarAlCarrito(comprador.cartId, nohay.variantId, 5);

    await expect(
      crearOrdenDesdeCarrito(
        compra(comprador, [
          { variantId: hay.variantId, unitPrice: "1000.00" },
          { variantId: nohay.variantId, unitPrice: "1000.00" },
        ]),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    expect(await contadores(hay.variantId)).toEqual({
      stockTotal: 50,
      reservedStock: 0,
    });
  });

  test("carrito vacío", async () => {
    const comprador = await unComprador();

    await expect(crearOrdenDesdeCarrito(compra(comprador, []))).rejects.toMatchObject(
      { code: "VALIDATION" },
    );
  });

  test("la dirección de otra persona es NOT_FOUND", async () => {
    const comprador = await unComprador();
    const ajeno = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregarAlCarrito(comprador.cartId, variantId, 1);

    // Sin RLS, el filtro por user_id en la aplicación es la única barrera
    // (§13.8). Cambiar el id en la petición no puede alcanzar para mandarse
    // el pedido a la dirección de otro.
    await expect(
      crearOrdenDesdeCarrito({
        ...compra(comprador, [{ variantId, unitPrice: "1000.00" }]),
        addressId: ajeno.addressId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

test("dos compradores sobre la última unidad: una orden y un rechazo", async () => {
  // La Compuerta F4, vista desde el checkout. Las dos peticiones se quedan
  // esperando la misma fila y se despiertan una detrás de la otra.
  const { variantId } = await unaVariante({ total: 1 });
  const uno = await unComprador();
  const otro = await unComprador();
  await agregarAlCarrito(uno.cartId, variantId, 1);
  await agregarAlCarrito(otro.cartId, variantId, 1);

  const resultados = await dosCompitiendo(
    (tx) =>
      tx
        .execute(
          sql`SELECT 1 FROM product_variants WHERE id = ${variantId} FOR UPDATE`,
        )
        .then(() => undefined),
    () =>
      crearOrdenDesdeCarrito(compra(uno, [{ variantId, unitPrice: "1000.00" }])),
    () =>
      crearOrdenDesdeCarrito(compra(otro, [{ variantId, unitPrice: "1000.00" }])),
  );

  const cumplidas = resultados.filter((r) => r.status === "fulfilled");
  const rechazadas = resultados.filter((r) => r.status === "rejected");

  expect(cumplidas).toHaveLength(1);
  expect(rechazadas).toHaveLength(1);
  expect(rechazadas[0].reason).toMatchObject({ code: "INSUFFICIENT_STOCK" });

  // La unidad se vendió una sola vez.
  expect(await contadores(variantId)).toEqual({
    stockTotal: 1,
    reservedStock: 1,
  });
  expect(await movimientos(variantId)).toHaveLength(1);

  // Y el que perdió conserva su carrito.
  const perdedor = resultados[0].status === "rejected" ? uno : otro;
  expect(await itemsEnElCarrito(perdedor.cartId)).toBe(1);
});
