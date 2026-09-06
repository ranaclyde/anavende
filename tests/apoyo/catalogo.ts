import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Datos de prueba mínimos para los tests de F4.
 *
 * Una variante no existe sola: cuelga de un producto, que cuelga de una marca
 * y de una categoría. Lo que hace falta para probar stock es eso y nada más,
 * así que esto crea la cadena más corta posible y se olvida del resto del
 * catálogo.
 *
 * **La limpieza va por borrado y no por transacción que se revierte**, y es
 * una decisión, no una comodidad: la Compuerta F4 necesita DOS transacciones
 * de verdad corriendo a la vez sobre la misma fila, y eso no se puede armar
 * adentro de una sola que después se deshace. Envolver todo en una transacción
 * dejaría justamente el test que importa fuera del patrón.
 *
 * El borrado se lleva todo en cascada: producto → variantes → movimientos.
 */

const creados: { productos: string[]; marcas: string[]; categorias: string[] } =
  { productos: [], marcas: [], categorias: [] };

export type VariantePrueba = {
  variantId: string;
  productId: string;
};

/**
 * Una variante con el stock que se le pida.
 *
 * `reservedStock` se escribe DIRECTO, sin pasar por `reservar()`: acá se está
 * preparando un escenario, no probando una operación. Si el escenario se
 * armara con la misma función que se prueba, un test de reserva rota podría
 * pasar en verde porque el escenario también salió mal.
 */
export async function unaVariante(
  stock: { total: number; reservado?: number } = { total: 0 },
): Promise<VariantePrueba> {
  const productId = await unProducto();

  const [variante] = await db.execute<{ id: string }>(sql`
    INSERT INTO product_variants (product_id, stock_total, reserved_stock)
    VALUES (${productId}, ${stock.total}, ${stock.reservado ?? 0})
    RETURNING id`);

  return { variantId: variante.id, productId };
}

/**
 * Un producto con su marca y su categoría, sin ninguna variante.
 *
 * Existe porque `variant_product_color_key` no deja dos variantes sin color
 * en el mismo producto: el test que inserta una variante a mano necesita un
 * producto virgen, no el que ya trae la suya.
 */
export async function unProducto(): Promise<string> {
  const sufijo = randomUUID().slice(0, 8);

  const [marca] = await db.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug) VALUES (${`Marca ${sufijo}`}, ${`marca-${sufijo}`})
    RETURNING id`);
  creados.marcas.push(marca.id);

  const [categoria] = await db.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug) VALUES (${`Rubro ${sufijo}`}, ${`rubro-${sufijo}`})
    RETURNING id`);
  creados.categorias.push(categoria.id);

  const [producto] = await db.execute<{ id: string }>(sql`
    INSERT INTO products (name, slug, brand_id, category_id, price)
    VALUES (${`Producto ${sufijo}`}, ${`producto-${sufijo}`},
            ${marca.id}, ${categoria.id}, '1000.00')
    RETURNING id`);
  creados.productos.push(producto.id);

  return producto.id;
}

/** Los dos contadores, tal como están en la base ahora mismo. */
export async function contadores(
  variantId: string,
): Promise<{ stockTotal: number; reservedStock: number }> {
  const [fila] = await db.execute<{
    stockTotal: number;
    reservedStock: number;
  }>(sql`
    SELECT stock_total AS "stockTotal", reserved_stock AS "reservedStock"
      FROM product_variants WHERE id = ${variantId}`);
  return fila;
}

export type Asiento = {
  type: string;
  quantity: number;
  stockAfter: number;
  reservedAfter: number;
  orderId: string | null;
  returnId: string | null;
  note: string | null;
};

/** El libro mayor de una variante, del más viejo al más nuevo. */
export async function movimientos(variantId: string): Promise<Asiento[]> {
  return [
    ...(await db.execute<Asiento>(sql`
      SELECT type,
             quantity,
             stock_after     AS "stockAfter",
             reserved_after  AS "reservedAfter",
             order_id        AS "orderId",
             return_id       AS "returnId",
             note
        FROM stock_movements
       WHERE variant_id = ${variantId}
       ORDER BY created_at, id`)),
  ];
}

/** Se llama desde un `afterEach`. Deja la base como la encontró. */
export async function limpiar(): Promise<void> {
  // El orden importa: los productos referencian marca y categoría con
  // RESTRICT, así que primero se van ellos.
  for (const id of creados.productos.splice(0)) {
    await db.execute(sql`DELETE FROM products WHERE id = ${id}`);
  }
  for (const id of creados.marcas.splice(0)) {
    await db.execute(sql`DELETE FROM brands WHERE id = ${id}`);
  }
  for (const id of creados.categorias.splice(0)) {
    await db.execute(sql`DELETE FROM categories WHERE id = ${id}`);
  }
}
