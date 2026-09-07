import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";

import { db } from "@/db";
import { crearOrdenDesdeCarrito } from "@/modules/orders/crear";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import {
  agregarAlCarrito,
  limpiarCompradores,
  unComprador,
} from "@/tests/apoyo/compradores";
import { limpiarOrdenes } from "@/tests/apoyo/ordenes";

/**
 * Los usuarios no se eliminan — §5.6, migración `0010`. Tarea F4.5b.
 *
 * Decisión del 2026-09-06, después de que la limpieza de un test de F4.3
 * reventara: `orders.user_id` era `ON DELETE SET NULL` y el CHECK
 * `web_order_has_user` prohibía exactamente ese NULL. Las dos cosas estaban en
 * §5.6, una al lado de la otra.
 *
 * No es una regla nueva: **RF-26 nunca tuvo «eliminar usuario»** —lista, crea,
 * modifica, resetea contraseña y bloquea— y RF-07 no tiene «cerrar mi cuenta».
 * Lo que había era un `SET NULL` escrito como si borrar fuera una función que
 * existe. Ahora la base dice lo mismo que los requisitos.
 */

afterEach(async () => {
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

async function borrarIdentidad(userId: string): Promise<unknown> {
  return db
    .execute(sql`DELETE FROM auth.users WHERE id = ${userId}`)
    .then(() => null)
    .catch((e: unknown) => e);
}

test("un comprador con órdenes no se puede borrar, y el error dice por qué", async () => {
  const comprador = await unComprador();
  const { variantId } = await unaVariante({ total: 10 });
  await agregarAlCarrito(comprador.cartId, variantId, 2);

  const { orderId } = await crearOrdenDesdeCarrito({
    userId: comprador.userId,
    idempotencyKey: randomUUID(),
    addressId: comprador.addressId,
    customerName: "Compradora de prueba",
    customerEmail: "compradora@ejemplo.test",
    customerPhone: "+5491155550000",
    esperado: [{ variantId, unitPrice: "1000.00" }],
  });

  const fallo = await borrarIdentidad(comprador.userId);

  // 23503 es violación de clave foránea, y Drizzle envuelve el error de
  // Postgres, así que el código vive en `cause`. Antes era 23514 —violación de
  // CHECK—, que fallaba igual pero sin explicar nada: decía que la fila
  // quedaba inválida, no que la persona tiene órdenes.
  const causa = (fallo as { cause?: { code?: string; message?: string } }).cause;
  expect(causa?.code).toBe("23503");
  expect(causa?.message).toContain("orders");

  // Y no se llevó nada por delante: ni la orden ni el perfil.
  const [{ n: ordenes }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM orders WHERE id = ${orderId}`);
  expect(ordenes).toBe(1);

  const [{ n: perfiles }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM user_profiles WHERE id = ${comprador.userId}`);
  expect(perfiles).toBe(1);
});

test("un usuario sin órdenes sí se borra, y hace falta que sea así", async () => {
  // Es la compensación de §13.4 paso 3: si el alta del perfil falla, se borra
  // la identidad recién creada. Bloquear TODO borrado dejaría identidades sin
  // perfil dando vueltas, que es un usuario que puede entrar y con el que la
  // aplicación no sabe qué hacer.
  const comprador = await unComprador();

  expect(await borrarIdentidad(comprador.userId)).toBeNull();

  const [{ n }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM user_profiles WHERE id = ${comprador.userId}`);
  expect(n).toBe(0);
});

test("borrarlo se lleva su carrito y sus direcciones, no su historial", async () => {
  // Lo que cuelga del perfil y no es historia sí va en cascada. Se comprueba
  // para que quede claro qué desaparece cuando el borrado SÍ se puede.
  const comprador = await unComprador();

  await borrarIdentidad(comprador.userId);

  const [{ n }] = await db.execute<{ n: number }>(sql`
    SELECT ((SELECT count(*) FROM carts     WHERE user_id = ${comprador.userId})
          + (SELECT count(*) FROM addresses WHERE user_id = ${comprador.userId})
           )::int AS n`);
  expect(n).toBe(0);
});
