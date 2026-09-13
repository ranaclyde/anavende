import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { agregar } from "@/modules/cart/operaciones";
import { contarUnidades, leerCarrito } from "@/modules/cart/queries";
import { revisarCarrito } from "@/modules/cart/revision";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * F5.6 — la revisión del carrito al abrirlo. RF-08, RN-09 · §5.5.
 *
 * «Hecho cuando»: precio cambiado avisa y toma el vigente; stock reducido
 * ajusta; desactivado se aparta en «Ya no disponible» hasta que el comprador
 * lo quita.
 *
 * Cada aviso se prueba DOS veces: que sale, y que la segunda revisión ya no
 * lo trae. «Se muestran una vez» (RF-08) es la mitad del requisito, y es la
 * mitad que se rompe sin que nadie lo note.
 */

afterEach(async () => {
  await limpiarCompradores();
  await limpiar();
});

async function cantidadEnElCarrito(
  userId: string,
  variantId: string,
): Promise<number> {
  const [fila] = await db.execute<{ quantity: number }>(sql`
    SELECT ci.quantity
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
     WHERE c.user_id = ${userId} AND ci.variant_id = ${variantId}`);
  return fila.quantity;
}

async function nombreDe(productId: string): Promise<string> {
  const [fila] = await db.execute<{ name: string }>(sql`
    SELECT name FROM products WHERE id = ${productId}`);
  return fila.name;
}

describe("revisar el carrito", () => {
  test("si nada cambió no hay avisos", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 2 });

    expect(await revisarCarrito(userId)).toEqual([]);
    expect(await cantidadEnElCarrito(userId, variantId)).toBe(2);
  });

  test("un comprador sin carrito no tiene nada que revisar", async () => {
    const { userId } = await unComprador();
    await db.execute(sql`DELETE FROM carts WHERE user_id = ${userId}`);

    expect(await revisarCarrito(userId)).toEqual([]);
  });

  test("el precio cambiado se avisa con los dos montos, una sola vez", async () => {
    const { userId } = await unComprador();
    const { variantId, productId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 2 });

    await db.execute(sql`
      UPDATE products SET price = '1200.00' WHERE id = ${productId}`);

    expect(await revisarCarrito(userId)).toEqual([
      {
        tipo: "precio",
        variantId,
        nombre: await nombreDe(productId),
        antes: "1000.00",
        ahora: "1200.00",
      },
    ]);
    // Visto el aviso, el vigente pasa a ser el «visto».
    expect(await revisarCarrito(userId)).toEqual([]);

    // Y el carrito cobra el vigente, no el que se vio (RN-09).
    const carrito = await leerCarrito(userId);
    expect(carrito.items[0]).toMatchObject({
      precioFinal: "1200.00",
      subtotal: "2400.00",
    });
  });

  test("un descuento nuevo también es un cambio de precio", async () => {
    const { userId } = await unComprador();
    const { variantId, productId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 1 });

    await db.execute(sql`
      UPDATE products SET discount = '250.00' WHERE id = ${productId}`);

    expect(await revisarCarrito(userId)).toMatchObject([
      { tipo: "precio", antes: "1000.00", ahora: "750.00" },
    ]);
  });

  test("agregar de nuevo desde la ficha actualiza el precio visto", async () => {
    const { userId } = await unComprador();
    const { variantId, productId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 1 });

    await db.execute(sql`
      UPDATE products SET price = '1200.00' WHERE id = ${productId}`);
    // Quien agrega está mirando la ficha con el precio nuevo: ya lo vio.
    await agregar(userId, { variantId, cantidad: 1 });

    expect(await revisarCarrito(userId)).toEqual([]);
  });

  test("con menos stock baja la cantidad a lo que queda, y avisa una vez", async () => {
    // El bug que encontraste el 2026-09-12: 3 en el carrito, 1 en stock.
    const { userId } = await unComprador();
    const { variantId, productId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 3 });

    await db.execute(sql`
      UPDATE product_variants SET stock_total = 1 WHERE id = ${variantId}`);

    expect(await revisarCarrito(userId)).toEqual([
      {
        tipo: "stock",
        variantId,
        nombre: await nombreDe(productId),
        quedan: 1,
      },
    ]);
    expect(await cantidadEnElCarrito(userId, variantId)).toBe(1);
    expect(await revisarCarrito(userId)).toEqual([]);
  });

  test("lo reservado en órdenes activas no cuenta como disponible", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 4 });

    // Siguen siendo 5, pero 3 ya están comprometidas: se pueden pedir 2.
    await db.execute(sql`
      UPDATE product_variants SET reserved_stock = 3 WHERE id = ${variantId}`);

    expect(await revisarCarrito(userId)).toMatchObject([
      { tipo: "stock", quedan: 2 },
    ]);
    expect(await cantidadEnElCarrito(userId, variantId)).toBe(2);
  });

  test("precio y stock a la vez: dos avisos, un solo renglón", async () => {
    const { userId } = await unComprador();
    const { variantId, productId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 3 });

    await db.execute(sql`
      UPDATE products SET price = '900.00' WHERE id = ${productId}`);
    await db.execute(sql`
      UPDATE product_variants SET stock_total = 2 WHERE id = ${variantId}`);

    expect(await revisarCarrito(userId)).toMatchObject([
      { tipo: "precio", antes: "1000.00", ahora: "900.00" },
      { tipo: "stock", quedan: 2 },
    ]);
    expect(await revisarCarrito(userId)).toEqual([]);
  });

  test("sin stock no se ajusta: queda marcado y fuera del total", async () => {
    const { userId } = await unComprador();
    const agotado = await unaVariante({ total: 5 });
    const otro = await unaVariante({ total: 5 });
    await agregar(userId, { variantId: agotado.variantId, cantidad: 2 });
    await agregar(userId, { variantId: otro.variantId, cantidad: 1 });

    await db.execute(sql`
      UPDATE product_variants SET stock_total = 0
       WHERE id = ${agotado.variantId}`);

    expect(await revisarCarrito(userId)).toEqual([]);
    // La cantidad no se toca: bajarla a cero no se puede, y borrarlo sería
    // destructivo. El comprador puede querer esperar a que vuelva.
    expect(await cantidadEnElCarrito(userId, agotado.variantId)).toBe(2);

    const carrito = await leerCarrito(userId);
    expect(carrito.items.map((i) => i.estado)).toEqual(["sin-stock", "vigente"]);
    expect(carrito.total).toBe("1000.00");
    expect(carrito.unidades).toBe(1);
    expect(await contarUnidades(userId)).toBe(1);
  });

  test("lo desactivado queda apartado, fuera del total, y no se revisa", async () => {
    const { userId } = await unComprador();
    const retirado = await unaVariante({ total: 5 });
    const otro = await unaVariante({ total: 5 });
    await agregar(userId, { variantId: retirado.variantId, cantidad: 2 });
    await agregar(userId, { variantId: otro.variantId, cantidad: 1 });

    // Se desactiva y además cambia de precio: de algo que ya no se vende no
    // se avisa el precio, se avisa que no se vende.
    await db.execute(sql`
      UPDATE products SET is_active = false, price = '1500.00'
       WHERE id = ${retirado.productId}`);

    expect(await revisarCarrito(userId)).toEqual([]);

    const carrito = await leerCarrito(userId);
    // Sigue en el carrito: es el aviso persistente (RF-08, variante B).
    expect(carrito.items.map((i) => i.estado)).toEqual([
      "no-disponible",
      "vigente",
    ]);
    expect(carrito.total).toBe("1000.00");
    expect(carrito.unidades).toBe(1);
    expect(await contarUnidades(userId)).toBe(1);
  });

  test("una variante desactivada también se aparta", async () => {
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 1 });

    await db.execute(sql`
      UPDATE product_variants SET is_active = false WHERE id = ${variantId}`);

    const carrito = await leerCarrito(userId);
    expect(carrito.items[0].estado).toBe("no-disponible");
    expect(carrito.total).toBe("0.00");
  });

  test("la píldora cuenta lo mismo antes y después de la revisión", async () => {
    // El encabezado y la página se arman a la vez: la cuenta puede correr
    // antes de que la revisión ajuste la cantidad, y tiene que dar lo mismo.
    const { userId } = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregar(userId, { variantId, cantidad: 3 });

    await db.execute(sql`
      UPDATE product_variants SET stock_total = 1 WHERE id = ${variantId}`);

    expect(await contarUnidades(userId)).toBe(1);
    await revisarCarrito(userId);
    expect(await contarUnidades(userId)).toBe(1);
  });
});
