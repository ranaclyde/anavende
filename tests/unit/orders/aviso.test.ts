import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { formatMoney } from "@/lib/money";
import { avisarNuevaOrden, datosDelAviso } from "@/modules/orders/avisar";
import { crearOrdenDesdeCarrito } from "@/modules/orders/crear";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import {
  agregarAlCarrito,
  limpiarCompradores,
  unComprador,
  type Comprador,
} from "@/tests/apoyo/compradores";
import { limpiarOrdenes } from "@/tests/apoyo/ordenes";

/**
 * E4, el aviso de nueva orden (RF-30 · TS §14): si falla, la orden se crea
 * igual. Se prueban los datos y no el HTML: `react-dom/server` no existe bajo
 * la condición `react-server` con la que corren los tests (ver `avisar.tsx`).
 */

const CASILLA = "avisos-de-prueba@ejemplo.test";

/** La fila de `site_settings` no la crea ninguna migración (§5.9). */
async function configurarLaCasilla(): Promise<void> {
  await db.execute(sql`
    INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
    VALUES (1, '+5492920000000', ${CASILLA})
    ON CONFLICT (id) DO UPDATE
       SET admin_notification_email = ${CASILLA}, updated_at = now()`);
}

let configPrevia: { whatsapp: string; email: string } | null = null;

beforeEach(async () => {
  const [fila] = await db.execute<{ whatsapp: string; email: string }>(sql`
    SELECT whatsapp_number AS whatsapp, admin_notification_email AS email
      FROM site_settings WHERE id = 1`);
  configPrevia = fila ?? null;
});

afterEach(async () => {
  // La configuración es de la instalación, no de este test: si había fila, se
  // la devuelve como estaba; si no había, se borra la que se creó acá.
  if (configPrevia) {
    await db.execute(sql`
      INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
      VALUES (1, ${configPrevia.whatsapp}, ${configPrevia.email})
      ON CONFLICT (id) DO UPDATE
         SET whatsapp_number = ${configPrevia.whatsapp},
             admin_notification_email = ${configPrevia.email}`);
  } else {
    await db.execute(sql`DELETE FROM site_settings WHERE id = 1`);
  }
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

async function ordenDe(
  comprador: Comprador,
  items: { variantId: string; unitPrice: string; quantity: number }[],
  entrega: "envio" | "retiro" = "envio",
): Promise<string> {
  const { orderId } = await crearOrdenDesdeCarrito({
    userId: comprador.userId,
    idempotencyKey: randomUUID(),
    entrega:
      entrega === "envio"
        ? { tipo: "envio", addressId: comprador.addressId }
        : { tipo: "retiro" },
    customerName: "Rosa Pereyra",
    customerEmail: "rosa@ejemplo.test",
    customerPhone: "+5492920111111",
    esperado: items,
  });
  return orderId;
}

async function unaOrdenDePrueba(
  entrega: "envio" | "retiro" = "envio",
): Promise<string> {
  const comprador = await unComprador();
  const { variantId } = await unaVariante({ total: 10 });
  await db.execute(sql`
    UPDATE products SET price = '1500.00', discount = '0.00'
     WHERE id = (SELECT product_id FROM product_variants WHERE id = ${variantId})`);
  await agregarAlCarrito(comprador.cartId, variantId, 2);
  return ordenDe(
    comprador,
    [{ variantId, unitPrice: "1500.00", quantity: 2 }],
    entrega,
  );
}

describe("lo que dice el aviso", () => {
  beforeEach(configurarLaCasilla);

  test("va a la casilla configurada, con el número en el asunto", async () => {
    const orderId = await unaOrdenDePrueba();
    const aviso = (await datosDelAviso(orderId))!;

    expect(aviso.to).toBe(CASILLA);
    // El número primero: es por lo que se busca en una bandeja llena.
    expect(aviso.subject).toMatch(/^Pedido #\d+ de Rosa Pereyra — \$/);
    // Y la referencia que va a Sentry NO lleva el nombre (§16).
    expect(aviso.reference).toMatch(/^orden #\d+$/);
    expect(aviso.reference).not.toContain("Rosa");
  });

  test("lleva comprador, teléfono, ítems y total (RF-30)", async () => {
    const orderId = await unaOrdenDePrueba();
    const { props } = (await datosDelAviso(orderId))!;

    expect(props.customer).toBe("Rosa Pereyra");
    expect(props.phone).toBe("+5492920111111");
    expect(props.email).toBe("rosa@ejemplo.test");
    expect(props.total).toBe(formatMoney("3000.00"));
    expect(props.items).toHaveLength(1);
    expect(props.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: formatMoney("1500.00"),
      subtotal: formatMoney("3000.00"),
    });
    // Los montos llegan formateados: la plantilla no hace aritmética (§7.1).
    expect(props.total).toMatch(/^\$/);
    // RF-30: enlace al detalle, por número, como el asunto.
    expect(props.link.endsWith(`/admin/ordenes/${props.orderNumber}`)).toBe(
      true,
    );
  });

  test("con envío dice la dirección entera; con retiro no dice dónde", async () => {
    const conEnvio = (await datosDelAviso(await unaOrdenDePrueba("envio")))!;
    // Entera: es lo que se le copia al mensajero.
    expect(conEnvio.props.delivery).toBe(
      "Envío a Av. Siempreviva 742, Rosario, Santa Fe, S2000",
    );

    await limpiarOrdenes();
    await limpiarCompradores();
    await limpiar();

    const conRetiro = (await datosDelAviso(await unaOrdenDePrueba("retiro")))!;
    // RN-10: el punto de entrega lo pasa ella por WhatsApp, no el email.
    expect(conRetiro.props.delivery).toBe("Retira en el punto de entrega");
  });
});

describe("lo que no puede hacer nunca", () => {
  test("sin casilla configurada no arma nada, y no explota", async () => {
    await db.execute(sql`DELETE FROM site_settings WHERE id = 1`);
    const orderId = await unaOrdenDePrueba();

    expect(await datosDelAviso(orderId)).toBeNull();
    // Y el que llama tampoco ve una excepción: la orden ya está creada.
    expect(await avisarNuevaOrden(orderId)).toBe(false);
  });

  test("una orden que no existe devuelve false, no una excepción", async () => {
    await configurarLaCasilla();
    expect(await avisarNuevaOrden(randomUUID())).toBe(false);
  });

  /**
   * Acá el aviso falla en el `render` (no hay `react-dom/server` en los
   * tests), no en el envío: RF-30 pide que falle donde falle, no salga afuera.
   */
  test("pase lo que pase adentro, la orden queda y nadie ve una excepción", async () => {
    await configurarLaCasilla();
    const orderId = await unaOrdenDePrueba();

    expect(await avisarNuevaOrden(orderId)).toBe(false);

    const [fila] = await db.execute<{ status: string }>(sql`
      SELECT status FROM orders WHERE id = ${orderId}`);
    expect(fila.status).toBe("activa");
  });
});
