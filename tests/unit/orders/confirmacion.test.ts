import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { enlaceDeWhatsApp, mensajeDeOrden } from "@/lib/whatsapp";
import { crearOrdenDesdeCarrito } from "@/modules/orders/crear";
import { leerOrdenDelComprador } from "@/modules/orders/queries";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import {
  agregarAlCarrito,
  limpiarCompradores,
  unComprador,
  type Comprador,
} from "@/tests/apoyo/compradores";
import { limpiarOrdenes } from "@/tests/apoyo/ordenes";

/**
 * F6.3 — la pantalla de confirmación y su mensaje de WhatsApp.
 * RF-12 · DESIGN-REFERENCE §7.5.
 *
 * «Hecho cuando»: número de orden, resumen y botón de WhatsApp como acción
 * principal; recargar no duplica.
 *
 * **Lo que recargar no duplica no se prueba acá**: la pantalla sólo lee, y
 * que dos confirmaciones con la misma clave devuelvan la misma orden ya está
 * probado en `crear.test.ts` (§8.5), que es donde vive esa garantía.
 */

afterEach(async () => {
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

async function ordenDe(
  comprador: Comprador,
  items: { variantId: string; unitPrice: string; quantity: number }[],
): Promise<number> {
  const { orderNumber } = await crearOrdenDesdeCarrito({
    userId: comprador.userId,
    idempotencyKey: randomUUID(),
    entrega: { tipo: "envio", addressId: comprador.addressId },
    customerName: "Rosa Pereyra",
    customerEmail: "rosa@ejemplo.test",
    customerPhone: "+5491155550000",
    esperado: items,
  });
  return orderNumber;
}

async function ponerPrecio(variantId: string, precio: string): Promise<void> {
  await db.execute(sql`
    UPDATE products SET price = ${precio}, discount = '0.00'
     WHERE id = (SELECT product_id FROM product_variants WHERE id = ${variantId})`);
}

describe("lo que la pantalla necesita leer", () => {
  test("trae los ítems del snapshot, el nombre del pedido y las unidades", async () => {
    const comprador = await unComprador();
    const uno = await unaVariante({ total: 10 });
    const otro = await unaVariante({ total: 10 });
    await ponerPrecio(uno.variantId, "1500.00");
    await ponerPrecio(otro.variantId, "2000.00");
    await agregarAlCarrito(comprador.cartId, uno.variantId, 3);
    await agregarAlCarrito(comprador.cartId, otro.variantId, 1);

    const numero = await ordenDe(comprador, [
      { variantId: uno.variantId, unitPrice: "1500.00", quantity: 3 },
      { variantId: otro.variantId, unitPrice: "2000.00", quantity: 1 },
    ]);

    const orden = await leerOrdenDelComprador(comprador.userId, numero);

    expect(orden).not.toBeNull();
    expect(orden!.numero).toBe(numero);
    expect(orden!.total).toBe("6500.00");
    // Cuatro unidades en dos renglones: el contador cuenta unidades, no
    // renglones, igual que el resumen del checkout.
    expect(orden!.unidades).toBe(4);
    // El del pedido, que puede no ser el de la cuenta (F6.1).
    expect(orden!.customerName).toBe("Rosa Pereyra");

    expect(orden!.items).toHaveLength(2);
    const porPrecio = [...orden!.items].sort((a, b) =>
      a.precioUnitario.localeCompare(b.precioUnitario),
    );
    expect(porPrecio[0]).toMatchObject({
      cantidad: 3,
      precioUnitario: "1500.00",
      subtotal: "4500.00",
    });
    expect(porPrecio[1]).toMatchObject({
      cantidad: 1,
      precioUnitario: "2000.00",
      subtotal: "2000.00",
    });
    // Como texto y no como número: `Money` es string en todo el sistema, y
    // un `json_build_object` sin el `::text` los devolvería con la precisión
    // de un float.
    for (const item of orden!.items) {
      expect(typeof item.precioUnitario).toBe("string");
      expect(typeof item.subtotal).toBe("string");
    }
  });

  test("los precios del snapshot sobreviven al cambio de precio", async () => {
    const comprador = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await ponerPrecio(variantId, "1000.00");
    await agregarAlCarrito(comprador.cartId, variantId, 2);

    const numero = await ordenDe(comprador, [
      { variantId, unitPrice: "1000.00", quantity: 2 },
    ]);

    await ponerPrecio(variantId, "9999.00");

    const orden = await leerOrdenDelComprador(comprador.userId, numero);
    expect(orden!.items[0].precioUnitario).toBe("1000.00");
    expect(orden!.total).toBe("2000.00");
  });

  test("la orden de otro es indistinguible de una que no existe (§13.8)", async () => {
    const comprador = await unComprador();
    const ajeno = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });
    await agregarAlCarrito(comprador.cartId, variantId, 1);
    const numero = await ordenDe(comprador, [
      { variantId, unitPrice: "1000.00", quantity: 1 },
    ]);

    expect(await leerOrdenDelComprador(ajeno.userId, numero)).toBeNull();
    expect(await leerOrdenDelComprador(comprador.userId, 999_999)).toBeNull();
  });
});

describe("el mensaje de WhatsApp del pedido", () => {
  const items = [
    { nombre: "Teclado K120", marca: "Logitech", color: "Negro", cantidad: 2 },
    { nombre: "Mouse M170", marca: "Logitech", color: null, cantidad: 1 },
  ];

  test("lleva el número, el nombre, qué se compró y el total", () => {
    const mensaje = mensajeDeOrden(1043, "Rosa Pereyra", items, "$ 49.000,00");

    // El número es lo que la vendedora usa para buscar en el panel, así que
    // va en su propio renglón y no escondido en una frase.
    expect(mensaje).toContain("Pedido #1043, a nombre de Rosa Pereyra");
    expect(mensaje).toContain("2 × Teclado K120 (Logitech), negro");
    expect(mensaje).toContain("Total: $ 49.000,00");
  });

  test("sin color no deja la coma colgando", () => {
    const mensaje = mensajeDeOrden(1043, "Rosa Pereyra", items, "$ 1,00");
    expect(mensaje).toContain("1 × Mouse M170 (Logitech)\n");
    expect(mensaje).not.toContain("(Logitech), \n");
  });

  test("no lleva precios por unidad: para eso está el panel", () => {
    const mensaje = mensajeDeOrden(1043, "Rosa Pereyra", items, "$ 49.000,00");
    // Un solo monto en todo el mensaje, y es el total.
    expect(mensaje.match(/\$/g)).toHaveLength(1);
  });

  test("el enlace escapa el salto de línea, el acento y el peso", () => {
    const enlace = enlaceDeWhatsApp(
      "+5491155550000",
      mensajeDeOrden(1043, "Rosa Pereyra", items, "$ 49.000,00"),
    );

    expect(enlace.startsWith("https://wa.me/5491155550000?text=")).toBe(true);
    // Ni un carácter crudo de los tres que rompen el enlace.
    const texto = enlace.slice("https://wa.me/5491155550000?text=".length);
    expect(texto).not.toMatch(/[\n$¡]/);
    // Y vuelve entero.
    expect(decodeURIComponent(texto)).toContain("Pedido #1043");
  });
});
