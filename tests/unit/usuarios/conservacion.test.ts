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

/** Los usuarios no se eliminan — TS §5.6. */

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
    entrega: { tipo: "envio", addressId: comprador.addressId },
    customerName: "Compradora de prueba",
    customerEmail: "compradora@ejemplo.test",
    customerPhone: "+5491155550000",
    esperado: [{ variantId, unitPrice: "1000.00", quantity: 2 }],
  });

  const fallo = await borrarIdentidad(comprador.userId);

  // 23503 es violación de clave foránea; Drizzle envuelve el error de
  // Postgres, así que el código vive en `cause`.
  const causa = (fallo as { cause?: { code?: string; message?: string } })
    .cause;
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
  // La compensación de §13.4 paso 3 borra la identidad si falla el alta del
  // perfil: bloquear TODO borrado dejaría identidades sin perfil.
  const comprador = await unComprador();

  expect(await borrarIdentidad(comprador.userId)).toBeNull();

  const [{ n }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM user_profiles WHERE id = ${comprador.userId}`);
  expect(n).toBe(0);
});

test("borrarlo se lleva su carrito y sus direcciones, no su historial", async () => {
  // Lo que cuelga del perfil y no es historia sí va en cascada.
  const comprador = await unComprador();

  await borrarIdentidad(comprador.userId);

  const [{ n }] = await db.execute<{ n: number }>(sql`
    SELECT ((SELECT count(*) FROM carts     WHERE user_id = ${comprador.userId})
          + (SELECT count(*) FROM addresses WHERE user_id = ${comprador.userId})
           )::int AS n`);
  expect(n).toBe(0);
});
