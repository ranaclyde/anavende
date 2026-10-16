import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Los datos del test de aislamiento — F10.1, TS §17.2 caso 6.
 *
 * Dos compradores de verdad: con cuenta en GoTrue y contraseña, porque el
 * test entra por la pantalla de ingreso y la sesión es la de la aplicación,
 * no una simulada. Cada uno tiene **lo mismo**: dos direcciones, un pedido
 * activo, el producto compartido en el carrito y en favoritos. B tiene además
 * un producto que A no tiene en ningún lado, para poder mirar que en las
 * pantallas de A no aparece.
 *
 * Habla con la base por su cuenta, sin `@/db`: ese módulo lleva
 * `server-only`, y este archivo corre en el proceso de Playwright.
 */

export type Producto = { productId: string; variantId: string; nombre: string };

export type Comprador = {
  userId: string;
  email: string;
  password: string;
  /** La primera es la predeterminada. */
  direcciones: [string, string];
  orden: { id: string; numero: number };
};

export type Escenario = {
  a: Comprador;
  b: Comprador;
  compartido: Producto;
  soloDeB: Producto;
};

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

const auth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
).auth.admin;

const creados = {
  usuarios: [] as string[],
  productos: [] as string[],
  marcas: [] as string[],
  categorias: [] as string[],
};

async function unProducto(
  nombre: string,
  reservado: number,
): Promise<Producto> {
  const sufijo = randomUUID().slice(0, 8);

  const [marca] = await sql<{ id: string }[]>`
    INSERT INTO brands (name, slug)
    VALUES (${`Marca ${sufijo}`}, ${`marca-${sufijo}`}) RETURNING id`;
  creados.marcas.push(marca.id);

  const [categoria] = await sql<{ id: string }[]>`
    INSERT INTO categories (name, slug)
    VALUES (${`Rubro ${sufijo}`}, ${`rubro-${sufijo}`}) RETURNING id`;
  creados.categorias.push(categoria.id);

  const [producto] = await sql<{ id: string }[]>`
    INSERT INTO products (name, slug, brand_id, category_id, price)
    VALUES (${nombre}, ${`aislamiento-${sufijo}`}, ${marca.id}, ${categoria.id},
            '1000.00')
    RETURNING id`;
  creados.productos.push(producto.id);

  const [variante] = await sql<{ id: string }[]>`
    INSERT INTO product_variants (product_id, stock_total, reserved_stock)
    VALUES (${producto.id}, 10, ${reservado}) RETURNING id`;

  return { productId: producto.id, variantId: variante.id, nombre };
}

async function unComprador(
  nombre: string,
  compartido: Producto,
): Promise<Comprador> {
  const sufijo = randomUUID().slice(0, 8);
  const email = `aislamiento-${nombre.toLowerCase()}-${sufijo}@ejemplo.test`;
  const password = `Prueba-${randomUUID()}`;

  const { data, error } = await auth.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  creados.usuarios.push(userId);

  await sql`
    INSERT INTO user_profiles (id, first_name, last_name, email, phone)
    VALUES (${userId}, ${`Compradora ${nombre}`}, ${sufijo}, ${email},
            '+5491155550000')`;

  const direcciones: string[] = [];
  for (const [label, predeterminada] of [
    ["Casa", true],
    ["Trabajo", false],
  ] as const) {
    const [fila] = await sql<{ id: string }[]>`
      INSERT INTO addresses
        (user_id, label, recipient_name, phone, street, number,
         city, province, postal_code, is_default)
      VALUES
        (${userId}, ${label}, ${`Compradora ${nombre}`}, '+5491155550000',
         'Av. Siempreviva', '742', 'Viedma', 'Río Negro', '8500',
         ${predeterminada})
      RETURNING id`;
    direcciones.push(fila.id);
  }

  const [orden] = await sql<{ id: string; numero: number }[]>`
    INSERT INTO orders
      (user_id, origin, status, customer_name, customer_email, customer_phone,
       total)
    VALUES
      (${userId}, 'web', 'activa', ${`Compradora ${nombre}`}, ${email},
       '+5491155550000', '1000.00')
    RETURNING id, order_number AS numero`;
  await sql`
    INSERT INTO order_items
      (order_id, variant_id, product_name, brand_name, unit_price, quantity)
    VALUES
      (${orden.id}, ${compartido.variantId}, ${compartido.nombre},
       'Marca de prueba', '1000.00', 1)`;
  await sql`
    INSERT INTO order_status_history (order_id, from_status, to_status)
    VALUES (${orden.id}, NULL, 'activa')`;

  const [carrito] = await sql<{ id: string }[]>`
    INSERT INTO carts (user_id) VALUES (${userId}) RETURNING id`;
  await sql`
    INSERT INTO cart_items (cart_id, variant_id, quantity, last_seen_price)
    VALUES (${carrito.id}, ${compartido.variantId}, 1, '1000.00')`;
  await sql`
    INSERT INTO favorites (user_id, product_id)
    VALUES (${userId}, ${compartido.productId})`;

  return {
    userId,
    email,
    password,
    direcciones: direcciones as [string, string],
    orden,
  };
}

export async function armarEscenario(): Promise<Escenario> {
  const marca = randomUUID().slice(0, 6);
  // Reservado 2: un pedido activo de cada uno. Cancelar el de A libera uno.
  const compartido = await unProducto(`Compartido ${marca}`, 2);
  const soloDeB = await unProducto(`Solo de B ${marca}`, 0);

  const a = await unComprador("A", compartido);
  const b = await unComprador("B", compartido);

  const [carritoDeB] = await sql<{ id: string }[]>`
    SELECT id FROM carts WHERE user_id = ${b.userId}`;
  await sql`
    INSERT INTO cart_items (cart_id, variant_id, quantity, last_seen_price)
    VALUES (${carritoDeB.id}, ${soloDeB.variantId}, 1, '1000.00')`;
  await sql`
    INSERT INTO favorites (user_id, product_id)
    VALUES (${b.userId}, ${soloDeB.productId})`;

  return { a, b, compartido, soloDeB };
}

/**
 * Las órdenes antes que las cuentas, por el CHECK `web_order_has_user` (ver
 * `tests/apoyo/compradores.ts`). Borrar la cuenta en GoTrue se lleva en
 * cascada el perfil, el carrito, las direcciones y los favoritos.
 */
export async function desarmarEscenario(): Promise<void> {
  for (const id of creados.usuarios.splice(0)) {
    await sql`DELETE FROM orders WHERE user_id = ${id}`;
    const { error } = await auth.deleteUser(id);
    if (error) throw error;
  }
  for (const id of creados.productos.splice(0)) {
    await sql`DELETE FROM products WHERE id = ${id}`;
  }
  for (const id of creados.marcas.splice(0)) {
    await sql`DELETE FROM brands WHERE id = ${id}`;
  }
  for (const id of creados.categorias.splice(0)) {
    await sql`DELETE FROM categories WHERE id = ${id}`;
  }
  await sql.end();
}

// ── Lo que se mira en la base después de cada intento ───────────────────

export async function laDireccion(id: string) {
  const [fila] = await sql`
    SELECT label, recipient_name, street, number, city, is_default, deleted_at
      FROM addresses WHERE id = ${id}`;
  return fila;
}

export async function estadoDeLaOrden(id: string): Promise<string> {
  const [fila] = await sql<{ status: string }[]>`
    SELECT status FROM orders WHERE id = ${id}`;
  return fila.status;
}

export async function variantesEnElCarrito(userId: string): Promise<string[]> {
  const filas = await sql<{ variant_id: string }[]>`
    SELECT i.variant_id FROM cart_items i
      JOIN carts c ON c.id = i.cart_id
     WHERE c.user_id = ${userId}`;
  return filas.map((f) => f.variant_id);
}

export async function productosFavoritos(userId: string): Promise<string[]> {
  const filas = await sql<{ product_id: string }[]>`
    SELECT product_id FROM favorites WHERE user_id = ${userId}`;
  return filas.map((f) => f.product_id);
}
