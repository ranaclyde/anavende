import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { sum } from "@/lib/money";
import {
  masVendidos,
  totalesDelPeriodo,
  ventasAgrupadas,
  ventasEnElTiempo,
  webContraManual,
} from "@/modules/reports/queries";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import { limpiarOrdenes, unaOrdenActiva } from "@/tests/apoyo/ordenes";

/**
 * F9.1 — los reportes de ventas. RF-28 · TS §15.
 *
 * **Todo pasa en marzo de 2001**, donde la base de desarrollo no tiene nada:
 * los reportes no filtran por dueño, y en un mes con ventas de verdad un
 * número absoluto dependería de con qué quedó la base. Así cada test arma su
 * mes entero y lo mide exacto.
 */

const MARZO = { desde: "2001-03-01", hasta: "2001-03-31" };

afterEach(async () => {
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

/** Un instante de marzo de 2001, a las `hora` de acá. */
function en(dia: number, hora = "12:00"): string {
  return `2001-03-${String(dia).padStart(2, "0")} ${hora}-03`;
}

/**
 * Una orden con `items`, llevada al estado que se pida y en el día que se
 * pida. Web necesita un comprador (la base lo exige); manual no.
 */
async function unaOrden(
  items: { variantId: string; cantidad: number; precio: string }[],
  opciones: {
    estado?: "finalizada" | "activa" | "cancelada";
    cuando: string;
    origen?: "web" | "manual";
  },
): Promise<string> {
  const { orderId } = await unaOrdenActiva(
    items.map((i) => ({
      variantId: i.variantId,
      quantity: i.cantidad,
      unitPrice: i.precio,
    })),
  );
  const estado = opciones.estado ?? "finalizada";
  const usuario =
    opciones.origen === "web" ? (await unComprador()).userId : null;

  await db.execute(sql`
    UPDATE orders
       SET status = ${estado},
           origin = ${opciones.origen ?? "manual"},
           user_id = ${usuario},
           created_at = ${opciones.cuando}::timestamptz - interval '1 day',
           finalized_at = CASE WHEN ${estado} = 'finalizada'
                               THEN ${opciones.cuando}::timestamptz END,
           cancelled_at = CASE WHEN ${estado} = 'cancelada'
                               THEN ${opciones.cuando}::timestamptz END,
           total = (SELECT sum(subtotal) FROM order_items WHERE order_id = ${orderId})
     WHERE id = ${orderId}`);

  return orderId;
}

/** Devuelve `cantidad` unidades del primer renglón de la orden. */
async function unaDevolucion(
  orderId: string,
  cantidad: number,
  opciones: { cuando: string; anulada?: boolean },
): Promise<void> {
  const [dev] = await db.execute<{ id: string }>(sql`
    INSERT INTO returns (order_id, status, reason, created_at)
    VALUES (${orderId}, ${opciones.anulada ? "anulada" : "registrada"},
            'Vino fallado', ${opciones.cuando})
    RETURNING id`);
  await db.execute(sql`
    INSERT INTO return_items (return_id, order_item_id, quantity, restocks)
    SELECT ${dev.id}, id, ${cantidad}, true
      FROM order_items WHERE order_id = ${orderId}
     ORDER BY created_at, id LIMIT 1`);
}

/** El nombre del producto y la marca de la variante, que crea el apoyo. */
async function nombres(variantId: string) {
  const [fila] = await db.execute<{
    producto: string;
    marca: string;
    categoria: string;
  }>(sql`
    SELECT p.name AS producto, b.name AS marca, c.name AS categoria
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      JOIN brands b ON b.id = p.brand_id
      JOIN categories c ON c.id = p.category_id
     WHERE v.id = ${variantId}`);
  return fila;
}

describe("totales del período (RF-28)", () => {
  test("solo cuentan las finalizadas", async () => {
    const { variantId } = await unaVariante({ total: 50 });
    await unaOrden([{ variantId, cantidad: 2, precio: "1000.00" }], {
      cuando: en(5),
    });
    await unaOrden([{ variantId, cantidad: 1, precio: "999.00" }], {
      cuando: en(6),
      estado: "activa",
    });
    await unaOrden([{ variantId, cantidad: 1, precio: "999.00" }], {
      cuando: en(7),
      estado: "cancelada",
    });

    expect(await totalesDelPeriodo(MARZO)).toEqual({
      vendido: "2000.00",
      devuelto: "0",
      ordenes: 1,
      unidades: 2,
      ticket: "2000.00",
    });
  });

  test("las devoluciones restan el día en que se registran, y las anuladas no", async () => {
    const { variantId } = await unaVariante({ total: 50 });
    // Vendida en febrero, devuelta en marzo: resta en marzo.
    const deFebrero = await unaOrden(
      [{ variantId, cantidad: 3, precio: "500.00" }],
      { cuando: "2001-02-20 12:00-03" },
    );
    await unaDevolucion(deFebrero, 1, { cuando: en(10) });
    await unaDevolucion(deFebrero, 1, { cuando: en(11), anulada: true });

    await unaOrden([{ variantId, cantidad: 2, precio: "1000.00" }], {
      cuando: en(12),
    });

    const marzo = await totalesDelPeriodo(MARZO);
    expect(marzo).toMatchObject({
      vendido: "1500.00",
      devuelto: "500.00",
      ordenes: 1,
      unidades: 1,
      // El ticket es de las órdenes del período, antes de devoluciones ajenas.
      ticket: "2000.00",
    });

    const febrero = await totalesDelPeriodo({
      desde: "2001-02-01",
      hasta: "2001-02-28",
    });
    expect(febrero).toMatchObject({ vendido: "1500.00", unidades: 3 });
  });

  test("el día se corta en la zona de acá, no en UTC", async () => {
    const { variantId } = await unaVariante({ total: 50 });
    // 22:30 del 31 de marzo acá es 01:30 del 1° de abril en UTC.
    await unaOrden([{ variantId, cantidad: 1, precio: "100.00" }], {
      cuando: en(31, "22:30"),
    });

    expect((await totalesDelPeriodo(MARZO)).ordenes).toBe(1);
    expect(
      (await totalesDelPeriodo({ desde: "2001-04-01", hasta: "2001-04-30" }))
        .ordenes,
    ).toBe(0);
  });

  test("sin ventas, todo en cero y el ticket también", async () => {
    expect(await totalesDelPeriodo(MARZO)).toEqual({
      vendido: "0",
      devuelto: "0",
      ordenes: 0,
      unidades: 0,
      ticket: "0",
    });
  });
});

describe("ventas en el tiempo", () => {
  test("un punto por día, con los días sin ventas en cero", async () => {
    const { variantId } = await unaVariante({ total: 50 });
    const orden = await unaOrden(
      [{ variantId, cantidad: 2, precio: "1000.00" }],
      { cuando: en(2) },
    );
    await unaOrden([{ variantId, cantidad: 1, precio: "300.00" }], {
      cuando: en(2, "18:00"),
    });
    await unaDevolucion(orden, 1, { cuando: en(4) });

    const serie = await ventasEnElTiempo(
      { desde: "2001-03-01", hasta: "2001-03-05" },
      "dia",
    );
    expect(serie).toEqual([
      { fecha: "2001-03-01", vendido: "0", ordenes: 0 },
      { fecha: "2001-03-02", vendido: "2300.00", ordenes: 2 },
      { fecha: "2001-03-03", vendido: "0", ordenes: 0 },
      { fecha: "2001-03-04", vendido: "-1000.00", ordenes: 0 },
      { fecha: "2001-03-05", vendido: "0", ordenes: 0 },
    ]);
  });

  test("por mes, un punto por mes aunque el rango empiece a mitad", async () => {
    const { variantId } = await unaVariante({ total: 50 });
    await unaOrden([{ variantId, cantidad: 1, precio: "100.00" }], {
      cuando: en(20),
    });

    const serie = await ventasEnElTiempo(
      { desde: "2001-01-15", hasta: "2001-04-10" },
      "mes",
    );
    expect(serie.map((p) => [p.fecha, p.vendido])).toEqual([
      ["2001-01-01", "0"],
      ["2001-02-01", "0"],
      ["2001-03-01", "100.00"],
      ["2001-04-01", "0"],
    ]);
  });

  test("los puntos suman lo mismo que el total", async () => {
    const { variantId } = await unaVariante({ total: 50 });
    const a = await unaOrden([{ variantId, cantidad: 3, precio: "250.50" }], {
      cuando: en(3),
    });
    await unaOrden([{ variantId, cantidad: 1, precio: "99.99" }], {
      cuando: en(17),
    });
    await unaDevolucion(a, 2, { cuando: en(25) });

    const serie = await ventasEnElTiempo(MARZO, "dia");
    const suma = sum(serie.map((p) => p.vendido));
    expect(suma).toBe((await totalesDelPeriodo(MARZO)).vendido);
  });
});

describe("por producto, categoría y marca", () => {
  test("más vendidos, con su desglose por color y netos de devoluciones", async () => {
    const uno = await unaVariante({ total: 50 });
    const otro = await unaVariante({ total: 50 });
    await db.execute(sql`
      UPDATE order_items SET color_name = 'Negro' WHERE variant_id = ${uno.variantId}`);

    const orden = await unaOrden(
      [
        { variantId: uno.variantId, cantidad: 5, precio: "100.00" },
        { variantId: otro.variantId, cantidad: 1, precio: "2000.00" },
      ],
      { cuando: en(8) },
    );
    await db.execute(sql`
      UPDATE order_items SET color_name = 'Negro'
       WHERE order_id = ${orden} AND variant_id = ${uno.variantId}`);
    await unaDevolucion(orden, 2, { cuando: en(9) });

    const n1 = await nombres(uno.variantId);
    const n2 = await nombres(otro.variantId);

    const porIngresos = await masVendidos(MARZO, "ingresos");
    expect(porIngresos.map((p) => [p.nombre, p.unidades, p.vendido])).toEqual([
      [n2.producto, 1, "2000.00"],
      [n1.producto, 3, "300.00"],
    ]);
    expect(porIngresos[1]).toMatchObject({
      marca: n1.marca,
      colores: [{ color: "Negro", unidades: 3, vendido: "300.00" }],
    });

    const porUnidades = await masVendidos(MARZO, "unidades");
    expect(porUnidades.map((p) => p.nombre)).toEqual([
      n1.producto,
      n2.producto,
    ]);
  });

  test("un producto solo devuelto no entra en el ranking", async () => {
    const { variantId } = await unaVariante({ total: 50 });
    const deFebrero = await unaOrden(
      [{ variantId, cantidad: 2, precio: "100.00" }],
      { cuando: "2001-02-10 12:00-03" },
    );
    await unaDevolucion(deFebrero, 1, { cuando: en(5) });

    expect(await masVendidos(MARZO, "ingresos")).toEqual([]);
    // Pero sí resta en su categoría, como resta en el total.
    const [categoria] = await ventasAgrupadas(MARZO, "categoria");
    expect(categoria).toMatchObject({ unidades: -1, vendido: "-100.00" });
  });

  test("por categoría y por marca, con los nombres de hoy", async () => {
    const uno = await unaVariante({ total: 50 });
    const otro = await unaVariante({ total: 50 });
    await unaOrden(
      [
        { variantId: uno.variantId, cantidad: 1, precio: "100.00" },
        { variantId: otro.variantId, cantidad: 2, precio: "400.00" },
      ],
      { cuando: en(8) },
    );
    const n1 = await nombres(uno.variantId);
    const n2 = await nombres(otro.variantId);

    expect(
      (await ventasAgrupadas(MARZO, "categoria")).map((f) => [
        f.nombre,
        f.unidades,
        f.vendido,
      ]),
    ).toEqual([
      [n2.categoria, 2, "800.00"],
      [n1.categoria, 1, "100.00"],
    ]);
    // El renglón dice «Marca de prueba» (el apoyo), y el reporte agrupa por
    // la marca del producto hoy.
    expect(
      (await ventasAgrupadas(MARZO, "marca")).map((f) => f.nombre),
    ).toEqual([n2.marca, n1.marca]);
  });
});

describe("web contra manual", () => {
  test("las dos filas salen siempre, netas de sus devoluciones", async () => {
    const { variantId } = await unaVariante({ total: 50 });
    expect(await webContraManual(MARZO)).toEqual([
      { origen: "web", vendido: "0", ordenes: 0 },
      { origen: "manual", vendido: "0", ordenes: 0 },
    ]);

    const web = await unaOrden([{ variantId, cantidad: 2, precio: "500.00" }], {
      cuando: en(3),
      origen: "web",
    });
    await unaOrden([{ variantId, cantidad: 1, precio: "700.00" }], {
      cuando: en(4),
    });
    await unaDevolucion(web, 1, { cuando: en(6) });

    expect(await webContraManual(MARZO)).toEqual([
      { origen: "web", vendido: "500.00", ordenes: 1 },
      { origen: "manual", vendido: "700.00", ordenes: 1 },
    ]);
  });
});
