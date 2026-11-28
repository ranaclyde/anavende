import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Único lugar que escribe en `auth.users` a mano (el esquema es de GoTrue,
 * §5.3): `user_profiles.id` tiene clave foránea contra esa tabla, y crearla
 * por la API de GoTrue metería la red en un test de dominio. Borrar la
 * identidad se lleva en cascada perfil, carrito, direcciones y favoritos.
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
    INSERT INTO user_profiles (id, first_name, last_name, email, phone)
    VALUES (${identidad.id}, 'Compradora', ${sufijo},
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
  // Con el precio vigente como «visto», como `agregar`, para no arrancar con
  // el aviso de cambio de precio.
  await db.execute(sql`
    INSERT INTO cart_items (cart_id, variant_id, quantity, last_seen_price)
    SELECT ${cartId}, v.id, ${quantity}, p.final_price
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
     WHERE v.id = ${variantId}`);
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

export async function itemsDeLaOrden(orderId: string): Promise<ItemDeOrden[]> {
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

/** Las órdenes van antes que la identidad: `orders.user_id` es RESTRICT. */
export async function limpiarCompradores(): Promise<void> {
  for (const id of creados.splice(0)) {
    await db.execute(sql`DELETE FROM orders WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}`);
  }
}
