import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import {
  agregarAlCarrito,
  limpiarCompradores,
  unComprador,
  type Comprador,
} from "@/tests/apoyo/compradores";
import { limpiarOrdenes } from "@/tests/apoyo/ordenes";

import { cancelarOrden, finalizarOrden } from "@/modules/orders/estados";
import {
  FILTROS_VACIOS,
  leerFiltros,
  urlDeFiltros,
  type FiltrosDeOrdenes,
} from "@/modules/orders/filtros-panel";
import { crearOrdenDesdeCarrito } from "@/modules/orders/crear";
import {
  contarPorEstado,
  leerOrdenDelPanel,
  listarOrdenesDelPanel,
} from "@/modules/orders/queries-panel";

/**
 * F7.1 — Listado y detalle de órdenes en el panel. RF-21 · TS §5.6.
 *
 * «Hecho cuando»: las solapas, los filtros y la búsqueda traen lo que dicen, y
 * el detalle muestra el pedido con su historial.
 *
 * **La base es de verdad y es la misma que usa el desarrollo**, así que puede
 * tener órdenes de antes. Estas consultas no filtran por usuario —el panel las
 * ve todas—, de modo que cada test se acota a las suyas buscando por un
 * apellido único: así las afirmaciones son sobre lo que el test creó y no
 * sobre lo que había.
 */

afterEach(async () => {
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

/** Un apellido que no puede existir en la base: acota cada test a lo suyo. */
function apellido(): string {
  return `Zzz${randomUUID().slice(0, 8)}`;
}

function filtros(cambios: Partial<FiltrosDeOrdenes> = {}): FiltrosDeOrdenes {
  return { ...FILTROS_VACIOS, solapa: "todas", ...cambios };
}

async function ordenDe(
  comprador: Comprador,
  {
    nombre,
    email = "rosa@ejemplo.test",
    cantidad = 1,
    entrega = "retiro",
  }: {
    nombre: string;
    email?: string | null;
    cantidad?: number;
    entrega?: "envio" | "retiro";
  },
): Promise<{ orderId: string; numero: number }> {
  const { variantId } = await unaVariante({ total: 20 });
  await agregarAlCarrito(comprador.cartId, variantId, cantidad);
  const { orderId, orderNumber } = await crearOrdenDesdeCarrito({
    userId: comprador.userId,
    idempotencyKey: randomUUID(),
    entrega:
      entrega === "envio"
        ? { tipo: "envio", addressId: comprador.addressId }
        : { tipo: "retiro" },
    customerName: nombre,
    customerEmail: email,
    customerPhone: "+5492920111111",
    esperado: [{ variantId, unitPrice: "1000.00", quantity: cantidad }],
  });
  return { orderId, numero: orderNumber };
}

describe("los filtros de la URL", () => {
  test("sin parámetros arranca en «Activas», página 1", () => {
    expect(leerFiltros({})).toEqual(FILTROS_VACIOS);
    // Y esos valores NO se escriben: la dirección queda limpia.
    expect(urlDeFiltros(FILTROS_VACIOS)).toBe("/admin/ordenes");
  });

  test("lo que no se reconoce se descarta en vez de fallar", () => {
    const f = leerFiltros({
      estado: "inventadas",
      origen: "correo",
      desde: "ayer",
      // Tiene forma de fecha y no existe: entraría a Postgres a hacerlo fallar.
      hasta: "2026-02-31",
      pagina: "-3",
    });

    expect(f).toEqual(FILTROS_VACIOS);
  });

  test("un rango al revés se endereza (no devuelve vacío)", () => {
    const f = leerFiltros({ desde: "2026-03-30", hasta: "2026-03-01" });
    expect(f.desde).toBe("2026-03-01");
    expect(f.hasta).toBe("2026-03-30");
  });

  test("la URL sólo lleva lo que se cambió", () => {
    expect(urlDeFiltros(filtros({ solapa: "canceladas", q: "gómez" }))).toBe(
      "/admin/ordenes?estado=canceladas&q=g%C3%B3mez",
    );
  });
});

describe("el listado", () => {
  test("trae las de todos los compradores, de la más nueva a la más vieja", async () => {
    const apodo = apellido();
    const una = await unComprador();
    const otra = await unComprador();
    const primera = await ordenDe(una, { nombre: `Rosa ${apodo}` });
    const segunda = await ordenDe(otra, { nombre: `Lucía ${apodo}` });

    const { ordenes, total } = await listarOrdenesDelPanel(
      filtros({ q: apodo }),
    );

    // Son de dos cuentas distintas: el panel no filtra por usuario.
    expect(total).toBe(2);
    expect(ordenes.map((o) => o.numero)).toEqual([
      segunda.numero,
      primera.numero,
    ]);
    expect(ordenes[0]).toMatchObject({ estado: "activa", origen: "web" });
  });

  test("cuenta unidades y no renglones", async () => {
    const apodo = apellido();
    const comprador = await unComprador();
    await ordenDe(comprador, { nombre: `Rosa ${apodo}`, cantidad: 3 });

    const { ordenes } = await listarOrdenesDelPanel(filtros({ q: apodo }));
    expect(ordenes[0].unidades).toBe(3);
    // El total llega como cadena: `Money` no pasa por `number` (§6).
    expect(ordenes[0].total).toBe("3000.00");
  });

  test("cada solapa trae su estado, y «Todas» los tres", async () => {
    const apodo = apellido();
    const comprador = await unComprador();
    const activa = await ordenDe(comprador, { nombre: `Ana ${apodo}` });
    const finalizada = await ordenDe(comprador, { nombre: `Bea ${apodo}` });
    const cancelada = await ordenDe(comprador, { nombre: `Cora ${apodo}` });

    await db.transaction((tx) =>
      finalizarOrden(tx, { orderId: finalizada.orderId }),
    );
    await db.transaction((tx) =>
      cancelarOrden(tx, { orderId: cancelada.orderId }),
    );

    const enSolapa = async (solapa: FiltrosDeOrdenes["solapa"]) =>
      (await listarOrdenesDelPanel(filtros({ solapa, q: apodo }))).ordenes.map(
        (o) => o.numero,
      );

    expect(await enSolapa("activas")).toEqual([activa.numero]);
    expect(await enSolapa("finalizadas")).toEqual([finalizada.numero]);
    expect(await enSolapa("canceladas")).toEqual([cancelada.numero]);
    expect((await enSolapa("todas")).sort()).toEqual(
      [activa.numero, finalizada.numero, cancelada.numero].sort(),
    );
  });

  test("busca por número exacto, por nombre sin tildes y por email", async () => {
    const apodo = apellido();
    const comprador = await unComprador();
    const { numero } = await ordenDe(comprador, {
      nombre: `Martín Gómez ${apodo}`,
      email: "martin.gomez@ejemplo.test",
    });

    const numeros = async (q: string) =>
      (await listarOrdenesDelPanel(filtros({ q }))).ordenes.map(
        (o) => o.numero,
      );

    expect(await numeros(String(numero))).toEqual([numero]);
    // Como se escribe en todas las pantallas del proyecto.
    expect(await numeros(`#${numero}`)).toEqual([numero]);
    // «Gomez» tiene que encontrar a «Gómez», y al revés.
    expect(await numeros(`gomez ${apodo}`)).toEqual([numero]);
    expect(await numeros("martin.gomez@ejemplo.test")).toEqual([numero]);

    // El número es un identificador, no una exploración: un prefijo no trae
    // la orden, porque quien lo escribe está yendo a una en particular.
    expect(await numeros(String(numero).slice(0, 3))).toEqual([]);
  });

  test("el filtro por origen separa la web de las manuales", async () => {
    const apodo = apellido();
    const comprador = await unComprador();
    const web = await ordenDe(comprador, { nombre: `Rosa ${apodo}` });

    // Una manual, que es lo que va a cargar F7.4. Se escribe a mano porque
    // todavía no hay función que las cree.
    const [manual] = await db.execute<{ numero: number }>(sql`
      INSERT INTO orders (origin, status, customer_name, customer_phone)
      VALUES ('manual', 'activa', ${`Vecina ${apodo}`}, '+5492920111111')
      RETURNING order_number AS numero`);

    const numeros = async (origen: FiltrosDeOrdenes["origen"]) =>
      (await listarOrdenesDelPanel(filtros({ origen, q: apodo }))).ordenes.map(
        (o) => o.numero,
      );

    expect(await numeros("web")).toEqual([web.numero]);
    expect(await numeros("manual")).toEqual([manual.numero]);
    expect((await numeros("todos")).length).toBe(2);

    await db.execute(sql`
      DELETE FROM orders WHERE order_number = ${manual.numero}`);
  });

  test("el rango incluye el día de «hasta» entero, en la zona de acá", async () => {
    const apodo = apellido();
    const comprador = await unComprador();
    const { orderId, numero } = await ordenDe(comprador, {
      nombre: `Rosa ${apodo}`,
    });

    // Las 23:30 de un 10 de marzo en Argentina son las 02:30 UTC del 11. Es
    // exactamente el caso que se rompe si el corte no lleva zona horaria: la
    // pantalla diría «10» y el filtro la contaría en el «11».
    await db.execute(sql`
      UPDATE orders SET created_at = '2026-03-10 23:30:00-03'
       WHERE id = ${orderId}`);

    const entre = async (desde: string, hasta: string) =>
      (
        await listarOrdenesDelPanel(filtros({ q: apodo, desde, hasta }))
      ).ordenes.map((o) => o.numero);

    expect(await entre("2026-03-10", "2026-03-10")).toEqual([numero]);
    expect(await entre("2026-03-01", "2026-03-31")).toEqual([numero]);
    expect(await entre("2026-03-11", "2026-03-31")).toEqual([]);
    expect(await entre("2026-03-01", "2026-03-09")).toEqual([]);
  });

  test("pagina, y la segunda página no repite la primera", async () => {
    const apodo = apellido();
    const comprador = await unComprador();
    for (const nombre of ["Ana", "Bea", "Cora"]) {
      await ordenDe(comprador, { nombre: `${nombre} ${apodo}` });
    }

    const p1 = await listarOrdenesDelPanel({
      ...filtros({ q: apodo }),
      pagina: 1,
    });
    // `POR_PAGINA` es 40 y acá hay 3: para probar el corte sin crear cuarenta
    // órdenes se mira que el total sea el de TODAS y no el de la página.
    expect(p1.total).toBe(3);
    expect(p1.ordenes).toHaveLength(3);

    const p2 = await listarOrdenesDelPanel({
      ...filtros({ q: apodo }),
      pagina: 2,
    });
    expect(p2.total).toBe(3);
    expect(p2.ordenes).toHaveLength(0);
  });

  test("el contador de las solapas sube con cada orden nueva", async () => {
    const antes = await contarPorEstado();
    const comprador = await unComprador();
    const { orderId } = await ordenDe(comprador, {
      nombre: `Rosa ${apellido()}`,
    });

    expect((await contarPorEstado()).activa).toBe(antes.activa + 1);

    await db.transaction((tx) => cancelarOrden(tx, { orderId }));

    const despues = await contarPorEstado();
    expect(despues.activa).toBe(antes.activa);
    expect(despues.cancelada).toBe(antes.cancelada + 1);
  });
});

describe("el detalle", () => {
  test("trae los ítems con precio unitario y subtotal, y la cuenta", async () => {
    const comprador = await unComprador();
    const { numero } = await ordenDe(comprador, {
      nombre: `Rosa ${apellido()}`,
      cantidad: 2,
      entrega: "envio",
    });

    const orden = (await leerOrdenDelPanel(numero))!;

    expect(orden.items).toHaveLength(1);
    expect(orden.items[0]).toMatchObject({
      cantidad: 2,
      precioUnitario: "1000.00",
      subtotal: "2000.00",
    });
    expect(orden.unidades).toBe(2);
    expect(orden.total).toBe("2000.00");
    expect(orden.shippingAddress).toMatchObject({ street: "Av. Siempreviva" });

    // La cuenta del comprador es OTRO dato que el nombre del pedido: el del
    // pedido vale sólo para ese pedido (F6.1).
    expect(orden.cuenta).toMatchObject({ id: comprador.userId });
    expect(orden.cuenta!.nombre).not.toBe(orden.customerName);
  });

  test("una orden manual sin cuenta no inventa una", async () => {
    const [fila] = await db.execute<{ numero: number }>(sql`
      INSERT INTO orders (origin, status, customer_name, customer_phone)
      VALUES ('manual', 'activa', 'Vecina del kiosco', '+5492920111111')
      RETURNING order_number AS numero`);

    const orden = (await leerOrdenDelPanel(fila.numero))!;
    expect(orden.origen).toBe("manual");
    expect(orden.cuenta).toBeNull();
    expect(orden.items).toEqual([]);

    await db.execute(
      sql`DELETE FROM orders WHERE order_number = ${fila.numero}`,
    );
  });

  test("el historial distingue el arrepentimiento de la cancelación del panel", async () => {
    const comprador = await unComprador();
    const vendedora = await unComprador();
    const propia = await ordenDe(comprador, { nombre: `Rosa ${apellido()}` });
    const ajena = await ordenDe(comprador, { nombre: `Rosa ${apellido()}` });

    await db.transaction((tx) =>
      cancelarOrden(tx, {
        orderId: propia.orderId,
        actorUserId: comprador.userId,
      }),
    );
    await db.transaction((tx) =>
      cancelarOrden(tx, {
        orderId: ajena.orderId,
        actorUserId: vendedora.userId,
        reason: "Sin stock real",
      }),
    );

    const arrepentida = (await leerOrdenDelPanel(propia.numero))!;
    const delPanel = (await leerOrdenDelPanel(ajena.numero))!;

    // La primera entrada de toda orden es el alta, sin estado anterior.
    expect(arrepentida.historial[0]).toMatchObject({
      desde: null,
      hacia: "activa",
    });
    expect(arrepentida.historial[1]).toMatchObject({
      desde: "activa",
      hacia: "cancelada",
      esElComprador: true,
      motivo: null,
    });
    expect(delPanel.historial[1]).toMatchObject({
      esElComprador: false,
      motivo: "Sin stock real",
    });
    // El autor se nombra: el historial sin quién no sirve de historial (RF-23).
    expect(delPanel.historial[1].autor).toBeTruthy();
  });

  test("un número que no existe no es una orden vacía", async () => {
    expect(await leerOrdenDelPanel(999_999_999)).toBeNull();
  });
});
