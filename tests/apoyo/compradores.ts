import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Compradores de prueba: identidad, perfil, carrito y dirección.
 *
 * **Se escribe en `auth.users` a mano, y es la única vez que este proyecto lo
 * hace.** Ese esquema lo administra GoTrue y el código de la aplicación no lo
 * toca ni lo lee (§5.3). Pero una orden web exige `user_id` por el CHECK
 * `web_order_has_user`, `user_profiles.id` tiene una clave foránea contra
 * `auth.users` desde la migración `0002`, y crear la identidad por la API de
 * GoTrue metería la red y medio Supabase adentro de un test de dominio. La
 * fila mínima que acepta la tabla son cinco columnas.
 *
 * Borrar la identidad se lleva todo: perfil, carrito, ítems, direcciones y
 * favoritos van en cascada.
 */

const creados: string[] = [];

export type Comprador = {
  userId: string;
  cartId: string;
  addressId: string;
};

export async function unComprador(): Promise<Comprador> {
  const sufijo = randomUUID().slice(0, 8);

  const [identidad] = await db.execute<{ id: string }>(sql`
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', ${`compra-${sufijo}@ejemplo.test`})
    RETURNING id`);
  creados.push(identidad.id);

  await db.execute(sql`
    INSERT INTO user_profiles (id, full_name, email, phone)
    VALUES (${identidad.id}, ${`Compradora ${sufijo}`},
            ${`compra-${sufijo}@ejemplo.test`}, '+5491155550000')`);

  const [carrito] = await db.execute<{ id: string }>(sql`
    INSERT INTO carts (user_id) VALUES (${identidad.id}) RETURNING id`);

  const [direccion] = await db.execute<{ id: string }>(sql`
    INSERT INTO addresses
      (user_id, label, recipient_name, phone, street, number,
       city, province, postal_code, is_default)
    VALUES
      (${identidad.id}, 'Casa', ${`Compradora ${sufijo}`}, '+5491155550000',
       'Av. Siempreviva', '742', 'Rosario', 'Santa Fe', 'S2000', true)
    RETURNING id`);

  return {
    userId: identidad.id,
    cartId: carrito.id,
    addressId: direccion.id,
  };
}

export async function agregarAlCarrito(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cart_items (cart_id, variant_id, quantity)
    VALUES (${cartId}, ${variantId}, ${quantity})`);
}

export async function itemsEnElCarrito(cartId: string): Promise<number> {
  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM cart_items WHERE cart_id = ${cartId}`);
  return fila.n;
}

export type ItemDeOrden = {
  variantId: string | null;
  productName: string;
  brandName: string;
  colorName: string | null;
  unitPrice: string;
  quantity: number;
  subtotal: string;
};

export async function itemsDeLaOrden(
  orderId: string,
): Promise<ItemDeOrden[]> {
  return [
    ...(await db.execute<ItemDeOrden>(sql`
      SELECT variant_id   AS "variantId",
             product_name AS "productName",
             brand_name   AS "brandName",
             color_name   AS "colorName",
             unit_price   AS "unitPrice",
             quantity,
             subtotal
        FROM order_items
       WHERE order_id = ${orderId}
       ORDER BY product_name`)),
  ];
}

export async function laOrden(orderId: string): Promise<{
  total: string;
  status: string;
  origin: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  shippingAddress: Record<string, unknown> | null;
  idempotencyKey: string | null;
}> {
  const [fila] = await db.execute<{
    total: string;
    status: string;
    origin: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
    shippingAddress: Record<string, unknown> | null;
    idempotencyKey: string | null;
  }>(sql`
    SELECT total, status, origin,
           customer_name    AS "customerName",
           customer_email   AS "customerEmail",
           customer_phone   AS "customerPhone",
           shipping_address AS "shippingAddress",
           idempotency_key  AS "idempotencyKey"
      FROM orders WHERE id = ${orderId}`);
  return fila;
}

/**
 * Se llama desde el mismo `afterEach` que las otras limpiezas.
 *
 * **Las órdenes se borran ANTES que la identidad, y no es un detalle de
 * orden.** `orders.user_id` es `ON DELETE SET NULL`, pero el CHECK
 * `web_order_has_user` exige que toda orden web tenga usuario: al borrar la
 * identidad, la cascada intenta poner el `user_id` en NULL y el CHECK la
 * rechaza. O sea que **un comprador con órdenes web no se puede borrar**, y
 * eso es una contradicción del modelo de datos, no una regla que alguien haya
 * decidido. Está anotada en PROGRESO como pendiente sin tarea propia; acá se
 * esquiva borrando las órdenes primero, que es lo que un test tiene que hacer.
 */
export async function limpiarCompradores(): Promise<void> {
  for (const id of creados.splice(0)) {
    await db.execute(sql`DELETE FROM orders WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}`);
  }
}
