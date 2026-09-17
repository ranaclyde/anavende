import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { money, subtract } from "@/lib/money";
import { comoVieneElMes, loQueHayParaHacer } from "@/modules/panel/tablero";
import { limpiar, unProducto, unaVariante } from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import { limpiarOrdenes, unaOrdenActiva } from "@/tests/apoyo/ordenes";

/**
 * F7.8 — los números del inicio del panel. RF-14 · RF-20, RF-28.
 *
 * **Todo se mide contra lo que ya había.** Estas lecturas no filtran por
 * dueño: cuentan la tienda entera, así que un número absoluto dependería de
 * con qué quedó la base de desarrollo. Lo que se prueba es la diferencia que
 * produce cada escenario, que es lo que el tablero promete.
 */

const UMBRAL = 3;

/** Los colores que crea este archivo: se borran al final, como todo lo demás. */
const colores: string[] = [];

afterEach(async () => {
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
  for (const id of colores.splice(0)) {
    await db.execute(sql`DELETE FROM colors WHERE id = ${id}`);
  }
});

/**
 * Un color propio, y no uno de los que estén sembrados.
 *
 * Un test que hace `FROM colors LIMIT 1` pasa o falla según con qué quedó la
 * base de desarrollo, y peor: sin colores sembrados no insertaría ninguna
 * variante y el escenario sería otro sin que el test lo dijera.
 */
async function unColor(): Promise<string> {
  const sufijo = randomUUID().slice(0, 8);
  const [color] = await db.execute<{ id: string }>(sql`
    INSERT INTO colors (name, slug, hex_code)
    VALUES (${`Prueba ${sufijo}`}, ${`prueba-${sufijo}`}, '#123456')
    RETURNING id`);
  colores.push(color.id);
  return color.id;
}

/** Una orden `finalizada` con un ítem, finalizada en el instante que se pida. */
async function unaOrdenFinalizada(opciones: {
  variantId: string;
  cantidad: number;
  precio: string;
  finalizadaEn?: "ahora" | "el mes pasado";
}): Promise<string> {
  const cuando =
    opciones.finalizadaEn === "el mes pasado"
      ? sql`now() - interval '1 month' - interval '3 days'`
      : sql`now()`;

  const { orderId } = await unaOrdenActiva([
    {
      variantId: opciones.variantId,
      quantity: opciones.cantidad,
      unitPrice: opciones.precio,
    },
  ]);

  await db.execute(sql`
    UPDATE orders
       SET status = 'finalizada',
           finalized_at = ${cuando},
           total = (SELECT sum(subtotal) FROM order_items WHERE order_id = ${orderId})
     WHERE id = ${orderId}`);

  return orderId;
}

/** Una devolución registrada de `cantidad` unidades del único ítem de la orden. */
async function unaDevolucion(
  orderId: string,
  cantidad: number,
  opciones: {
    anulada?: boolean;
    registradaEn?: "ahora" | "el mes pasado";
  } = {},
): Promise<void> {
  const cuando =
    opciones.registradaEn === "el mes pasado"
      ? sql`now() - interval '1 month' - interval '3 days'`
      : sql`now()`;

  const [devolucion] = await db.execute<{ id: string }>(sql`
    INSERT INTO returns (order_id, status, reason, created_at)
    VALUES (${orderId}, ${opciones.anulada ? "anulada" : "registrada"},
            'No le gustó', ${cuando})
    RETURNING id`);

  await db.execute(sql`
    INSERT INTO return_items (return_id, order_item_id, quantity, restocks)
    SELECT ${devolucion.id}, id, ${cantidad}, true
      FROM order_items WHERE order_id = ${orderId} LIMIT 1`);
}

describe("lo que hay para hacer (RF-14)", () => {
  test("cuenta las órdenes activas, y no las finalizadas ni las canceladas", async () => {
    const antes = await loQueHayParaHacer(UMBRAL);
    const { variantId } = await unaVariante({ total: 50 });

    await unaOrdenActiva([{ variantId, quantity: 1 }]);
    await unaOrdenActiva([{ variantId, quantity: 1 }]);
    const finalizada = await unaOrdenActiva([{ variantId, quantity: 1 }]);
    await db.execute(sql`
      UPDATE orders SET status = 'finalizada', finalized_at = now()
       WHERE id = ${finalizada.orderId}`);

    const ahora = await loQueHayParaHacer(UMBRAL);
    // Una activa es una entrega pendiente; una finalizada ya no espera a nadie.
    expect(ahora.ordenesActivas).toBe(antes.ordenesActivas + 2);
  });

  test("el stock se suma por producto, no por variante", async () => {
    const antes = await loQueHayParaHacer(UMBRAL);

    // Un producto con un color agotado y otro con diez NO hay que reponerlo:
    // preguntado variante por variante, aparecería como sin stock.
    const productId = await unProducto();
    await db.execute(sql`
      INSERT INTO product_variants (product_id, color_id, stock_total)
      VALUES (${productId}, ${await unColor()}, 0),
             (${productId}, ${await unColor()}, 10)`);

    const ahora = await loQueHayParaHacer(UMBRAL);
    expect(ahora.paraReponer).toBe(antes.paraReponer);
    expect(ahora.sinStock).toBe(antes.sinStock);
  });

  test("lo reservado no está disponible: cuenta para reponer", async () => {
    const antes = await loQueHayParaHacer(UMBRAL);

    // Diez unidades con nueve reservadas son una disponible: el tablero mira
    // lo mismo que el listado de productos, que es el disponible (RF-15).
    await unaVariante({ total: 10, reservado: 9 });

    const ahora = await loQueHayParaHacer(UMBRAL);
    expect(ahora.paraReponer).toBe(antes.paraReponer + 1);
    expect(ahora.sinStock).toBe(antes.sinStock);
  });

  test("el que está en cero se cuenta en los dos números", async () => {
    const antes = await loQueHayParaHacer(UMBRAL);
    await unaVariante({ total: 0 });

    // «Sin stock» es un subconjunto de «para reponer», no otra lista: RF-20 lo
    // resuelve con un solo filtro, y acá se nombra aparte porque es lo urgente.
    const ahora = await loQueHayParaHacer(UMBRAL);
    expect(ahora.paraReponer).toBe(antes.paraReponer + 1);
    expect(ahora.sinStock).toBe(antes.sinStock + 1);
  });

  test("el que tiene de sobra no aparece", async () => {
    const antes = await loQueHayParaHacer(UMBRAL);
    await unaVariante({ total: UMBRAL + 1 });

    const ahora = await loQueHayParaHacer(UMBRAL);
    expect(ahora.paraReponer).toBe(antes.paraReponer);
  });

  test("un producto apagado no es trabajo de hoy", async () => {
    const antes = await loQueHayParaHacer(UMBRAL);
    const { productId } = await unaVariante({ total: 0 });
    await db.execute(sql`
      UPDATE products SET is_active = false WHERE id = ${productId}`);

    // No se vende, así que reponerlo no urge. Y el enlace lleva al listado con
    // ese mismo filtro, para que el número y lo que se abre coincidan.
    const ahora = await loQueHayParaHacer(UMBRAL);
    expect(ahora.paraReponer).toBe(antes.paraReponer);
    expect(ahora.sinStock).toBe(antes.sinStock);
  });

  test("las bajas pedidas son las que nadie ejecutó", async () => {
    const antes = await loQueHayParaHacer(UMBRAL);
    const comprador = await unComprador();
    await db.execute(sql`
      UPDATE user_profiles
         SET closure_requested_at = now(), closure_reason = 'Chau'
       WHERE id = ${comprador.userId}`);

    expect((await loQueHayParaHacer(UMBRAL)).bajasPedidas).toBe(
      antes.bajasPedidas + 1,
    );

    // Ejecutada deja de ser trabajo por hacer (F7.9).
    await db.execute(sql`
      UPDATE user_profiles SET closed_at = now() WHERE id = ${comprador.userId}`);
    expect((await loQueHayParaHacer(UMBRAL)).bajasPedidas).toBe(
      antes.bajasPedidas,
    );
  });
});

describe("cómo viene el mes (RF-14 sobre RF-28)", () => {
  test("suma las finalizadas del mes y nada más", async () => {
    const antes = await comoVieneElMes();
    const { variantId } = await unaVariante({ total: 100 });

    await unaOrdenFinalizada({ variantId, cantidad: 2, precio: "1500.00" });
    // Activa: todavía puede cancelarse, así que no es una venta.
    await unaOrdenActiva([{ variantId, quantity: 5 }]);
    // Cancelada: nunca fue una venta.
    const cancelada = await unaOrdenActiva([{ variantId, quantity: 5 }]);
    await db.execute(sql`
      UPDATE orders SET status = 'cancelada', cancelled_at = now()
       WHERE id = ${cancelada.orderId}`);

    const ahora = await comoVieneElMes();
    expect(subtract(ahora.vendido, antes.vendido)).toBe(money("3000.00"));
    expect(ahora.ordenes).toBe(antes.ordenes + 1);
  });

  test("lo finalizado el mes pasado no entra", async () => {
    const antes = await comoVieneElMes();
    const { variantId } = await unaVariante({ total: 100 });

    await unaOrdenFinalizada({
      variantId,
      cantidad: 1,
      precio: "9999.00",
      finalizadaEn: "el mes pasado",
    });

    // El corte es por `finalized_at`: la venta ocurre cuando se entrega.
    const ahora = await comoVieneElMes();
    expect(subtract(ahora.vendido, antes.vendido)).toBe(money("0"));
    expect(ahora.ordenes).toBe(antes.ordenes);
  });

  test("las devoluciones restan, y las anuladas no", async () => {
    const antes = await comoVieneElMes();
    const { variantId } = await unaVariante({ total: 100 });

    const orden = await unaOrdenFinalizada({
      variantId,
      cantidad: 4,
      precio: "1000.00",
    });
    await unaDevolucion(orden, 1);
    await unaDevolucion(orden, 2, { anulada: true });

    // 4000 vendidos menos 1000 devueltos. La anulada es una devolución que no
    // ocurrió: restarla sería descontar dos veces lo mismo.
    const ahora = await comoVieneElMes();
    expect(subtract(ahora.vendido, antes.vendido)).toBe(money("3000.00"));
    // Restan del vendido, no de la cantidad de órdenes: la venta existió.
    expect(ahora.ordenes).toBe(antes.ordenes + 1);
  });

  test("la devolución del mes pasado no resta de éste", async () => {
    const antes = await comoVieneElMes();
    const { variantId } = await unaVariante({ total: 100 });

    const orden = await unaOrdenFinalizada({
      variantId,
      cantidad: 2,
      precio: "1000.00",
    });
    await unaDevolucion(orden, 1, { registradaEn: "el mes pasado" });

    // RF-28: restan en el período en que se registraron.
    const ahora = await comoVieneElMes();
    expect(subtract(ahora.vendido, antes.vendido)).toBe(money("2000.00"));
  });

  test("cuenta los productos activos, y no los apagados", async () => {
    const antes = await comoVieneElMes();
    await unaVariante({ total: 5 });
    const apagado = await unaVariante({ total: 5 });
    await db.execute(sql`
      UPDATE products SET is_active = false WHERE id = ${apagado.productId}`);

    expect((await comoVieneElMes()).productosActivos).toBe(
      antes.productosActivos + 1,
    );
  });

  test("el `desde` del enlace es el 1° del mes, en la zona del negocio", async () => {
    const { desde } = await comoVieneElMes();

    // Es lo que el listado de órdenes recibe como `?desde=`: si no coincidiera
    // con el corte de la consulta, el tablero diría un número y el listado
    // mostraría otro.
    expect(desde).toMatch(/^\d{4}-\d{2}-01$/);

    const [fila] = await db.execute<{ hoy: string }>(sql`
      SELECT to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires',
                     'YYYY-MM') AS hoy`);
    expect(desde.slice(0, 7)).toBe(fila.hoy);
  });
});
