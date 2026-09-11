import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  agregar,
  cambiarCantidad,
  quitar,
  vaciar,
} from "@/modules/cart/operaciones";
import { contarUnidades, leerCarrito } from "@/modules/cart/queries";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * F5.5 — el carrito. RF-08 · §5.5, §7.1, §13.8.
 *
 * «Hecho cuando»: agregar, quitar, cambiar cantidad, vaciar. No existe
 * carrito sin sesión.
 *
 * La mitad de «sin sesión» no se prueba acá: la sostiene el envoltorio de
 * §6.2, que rechaza una acción `customer` sin sesión antes de llegar a estas
 * funciones, y ya está probado desde F1.10. Lo que sí se prueba es la otra
 * cara de esa regla: que un comprador no alcance el carrito de otro (§13.8,
 * y §17.2 caso 6 para el carrito).
 */

afterEach(async () => {
  await limpiarCompradores();
  await limpiar();
});

/** Los renglones del carrito de un comprador, en orden de llegada. */
async function renglones(userId: string) {
  return [
    ...(await db.execute<{ variantId: string; quantity: number }>(sql`
      SELECT ci.variant_id AS "variantId", ci.quantity
        FROM cart_items ci
        JOIN carts c ON c.id = ci.cart_id
       WHERE c.user_id = ${userId}
       ORDER BY ci.added_at, ci.id`)),
  ];
}

async function carritosDe(userId: string): Promise<number> {
  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM carts WHERE user_id = ${userId}`);
  return fila.n;
}

async function unCompradorSinCarrito(): Promise<string> {
  const { userId } = await unComprador();
  await db.execute(sql`DELETE FROM carts WHERE user_id = ${userId}`);
  return userId;
}

describe("agregar", () => {
  test("la primera vez crea el carrito", async () => {
    const userId = await unCompradorSinCarrito();
    const { variantId } = await unaVariante({ total: 5 });

    expect(await agregar(userId, { variantId, cantidad: 2 })).toEqual({
      cantidad: 2,
    });
    expect(await carritosDe(userId)).toBe(1);
    expect(await renglones(userId)).toEqual([{ variantId, quantity: 2 }]);
  });

  test("lo que ya está suma en el mismo renglón", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    await agregar(userId, { variantId, cantidad: 2 });
    expect(await agregar(userId, { variantId, cantidad: 1 })).toEqual({
      cantidad: 3,
    });
    expect(await renglones(userId)).toEqual([{ variantId, quantity: 3 }]);
  });

  test("no deja pasar lo disponible, y lo reservado no está disponible", async () => {
    const { userId } = await unComprador();
    // 5 en total, 2 comprometidas en órdenes activas: se pueden pedir 3.
    const { variantId } = await unaVariante({ total: 5, reservado: 2 });

    await agregar(userId, { variantId, cantidad: 3 });

    await expect(
      agregar(userId, { variantId, cantidad: 1 }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      message: "Quedan 3 unidades y ya tenés 3 en el carrito.",
      details: { quedan: 3, enElCarrito: 3 },
    });
    expect(await renglones(userId)).toEqual([{ variantId, quantity: 3 }]);
  });

  test("sin stock no entra, y no queda un carrito creado a medias", async () => {
    const userId = await unCompradorSinCarrito();
    const { variantId } = await unaVariante({ total: 0 });

    await expect(
      agregar(userId, { variantId, cantidad: 1 }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      message: "Este color se quedó sin stock.",
    });
    // El carrito se crea en la misma transacción que falla: se revierte con
    // ella. Todo o nada, como el resto de las operaciones de dinero y stock.
    expect(await carritosDe(userId)).toBe(0);
  });

  test("el stock negativo (RF-24) cuenta como cero", async () => {
    const { userId } = await unComprador();
    // Una venta cargada sobre unidades que el sistema no tenía: la migración
    // `0003` deja el total por debajo de cero, y lo disponible da -1.
    const { variantId } = await unaVariante({ total: -1 });

    await expect(
      agregar(userId, { variantId, cantidad: 1 }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", details: { quedan: 0 } });
  });

  test("hay un tope por renglón aunque sobre stock", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 500 });

    await agregar(userId, { variantId, cantidad: 99 });

    await expect(
      agregar(userId, { variantId, cantidad: 1 }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      details: { quedan: 99, enElCarrito: 99 },
    });
  });

  test("una variante desactivada, o de un producto desactivado, no entra", async () => {
    const { userId } = await unComprador();
    const apagada = await unaVariante({ total: 5 });
    const deProductoApagado = await unaVariante({ total: 5 });

    await db.execute(sql`
      UPDATE product_variants SET is_active = false
       WHERE id = ${apagada.variantId}`);
    await db.execute(sql`
      UPDATE products SET is_active = false
       WHERE id = ${deProductoApagado.productId}`);

    for (const { variantId } of [apagada, deProductoApagado]) {
      await expect(
        agregar(userId, { variantId, cantidad: 1 }),
      ).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
    }
    expect(await renglones(userId)).toEqual([]);
  });

  test("una variante que no existe da NOT_FOUND", async () => {
    const { userId } = await unComprador();

    await expect(
      agregar(userId, { variantId: randomUUID(), cantidad: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("cambiar la cantidad", () => {
  test("sube dentro de lo disponible y baja", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 1 });

    await cambiarCantidad(userId, { variantId, cantidad: 4 });
    expect(await renglones(userId)).toEqual([{ variantId, quantity: 4 }]);

    await cambiarCantidad(userId, { variantId, cantidad: 2 });
    expect(await renglones(userId)).toEqual([{ variantId, quantity: 2 }]);
  });

  test("no sube más allá de lo disponible", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 1 });

    await expect(
      cambiarCantidad(userId, { variantId, cantidad: 6 }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      message: "Quedan 5 unidades.",
      details: { quedan: 5 },
    });
    expect(await renglones(userId)).toEqual([{ variantId, quantity: 1 }]);
  });

  test("bajar se puede aunque el stock ya no alcance, y subir no", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 4 });

    // Se vendió por otro lado: queda 1 y el carrito tiene 4.
    await db.execute(sql`
      UPDATE product_variants SET stock_total = 1 WHERE id = ${variantId}`);

    await cambiarCantidad(userId, { variantId, cantidad: 3 });
    expect(await renglones(userId)).toEqual([{ variantId, quantity: 3 }]);

    await expect(
      cambiarCantidad(userId, { variantId, cantidad: 4 }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  test("algo que no está en el carrito da NOT_FOUND", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    await expect(
      cambiarCantidad(userId, { variantId, cantidad: 2 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("quitar y vaciar", () => {
  test("quitar se lleva un renglón y deja el resto", async () => {
    const { userId } = await unComprador();
    const a = await unaVariante({ total: 5 });
    const b = await unaVariante({ total: 5 });
    await agregar(userId, { variantId: a.variantId, cantidad: 1 });
    await agregar(userId, { variantId: b.variantId, cantidad: 2 });

    expect(await quitar(userId, a.variantId)).toEqual({ quitado: true });
    expect(await renglones(userId)).toEqual([
      { variantId: b.variantId, quantity: 2 },
    ]);
  });

  test("quitar algo que ya no está no es un error", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 1 });

    await quitar(userId, variantId);
    expect(await quitar(userId, variantId)).toEqual({ quitado: false });
  });

  test("vaciar se lleva todos los renglones y el carrito queda", async () => {
    const { userId } = await unComprador();
    const a = await unaVariante({ total: 5 });
    const b = await unaVariante({ total: 5 });
    await agregar(userId, { variantId: a.variantId, cantidad: 1 });
    await agregar(userId, { variantId: b.variantId, cantidad: 2 });

    expect(await vaciar(userId)).toEqual({ quitados: 2 });
    expect(await renglones(userId)).toEqual([]);
    expect(await carritosDe(userId)).toBe(1);
  });
});

describe("aislamiento entre compradores (§13.8)", () => {
  test("nadie lee ni toca el carrito de otro", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(ana.userId, { variantId, cantidad: 2 });

    expect(await quitar(otro.userId, variantId)).toEqual({ quitado: false });
    expect(await vaciar(otro.userId)).toEqual({ quitados: 0 });
    await expect(
      cambiarCantidad(otro.userId, { variantId, cantidad: 5 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect((await leerCarrito(otro.userId)).items).toEqual([]);
    expect(await contarUnidades(otro.userId)).toBe(0);

    // Y el de Ana sigue exactamente como estaba.
    expect(await renglones(ana.userId)).toEqual([{ variantId, quantity: 2 }]);
  });
});

describe("leer el carrito", () => {
  test("los subtotales y el total salen de la base, con el precio final", async () => {
    const { userId } = await unComprador();
    const conDescuento = await unaVariante({ total: 10 });
    const sinDescuento = await unaVariante({ total: 10 });

    // Los dos productos cuestan 1000.00; uno con 150.00 de descuento.
    await db.execute(sql`
      UPDATE products SET discount = '150.00'
       WHERE id = ${conDescuento.productId}`);

    await agregar(userId, { variantId: conDescuento.variantId, cantidad: 3 });
    await agregar(userId, { variantId: sinDescuento.variantId, cantidad: 2 });

    const carrito = await leerCarrito(userId);

    expect(carrito.items).toMatchObject([
      {
        variantId: conDescuento.variantId,
        precio: "1000.00",
        descuento: "150.00",
        precioFinal: "850.00",
        cantidad: 3,
        subtotal: "2550.00",
        disponible: 10,
        seVende: true,
        imagenKey: null,
        colorNombre: null,
      },
      {
        variantId: sinDescuento.variantId,
        precioFinal: "1000.00",
        cantidad: 2,
        subtotal: "2000.00",
      },
    ]);
    expect(carrito.total).toBe("4550.00");
    expect(carrito.unidades).toBe(5);
    expect(await contarUnidades(userId)).toBe(5);
  });

  test("el precio no se congela: el carrito muestra el vigente (RN-09)", async () => {
    const { userId } = await unComprador();
    const { variantId, productId } = await unaVariante({ total: 10 });
    await agregar(userId, { variantId, cantidad: 2 });

    await db.execute(sql`
      UPDATE products SET price = '1200.00' WHERE id = ${productId}`);

    const carrito = await leerCarrito(userId);
    expect(carrito.items[0]).toMatchObject({
      precioFinal: "1200.00",
      subtotal: "2400.00",
    });
    expect(carrito.total).toBe("2400.00");
  });

  test("vacío, o sin carrito todavía", async () => {
    const conCarrito = await unComprador();
    const sinCarrito = await unCompradorSinCarrito();

    for (const userId of [conCarrito.userId, sinCarrito]) {
      expect(await leerCarrito(userId)).toEqual({
        items: [],
        total: "0.00",
        unidades: 0,
      });
      expect(await contarUnidades(userId)).toBe(0);
    }
  });
});
