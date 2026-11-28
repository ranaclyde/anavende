import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import { todayInArgentina } from "@/lib/dates";
import { contadores, limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import { limpiarOrdenes } from "@/tests/apoyo/ordenes";

/**
 * La puerta del alta manual (RF-24 · TS §6.2); el dominio va en
 * `manual.test.ts`. Acá: quién puede cargar una venta, la validación de lo que
 * escribe una persona y que con envío la dirección sea obligatoria.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({
  getSession: async () => sesion.actual,
  // Sin sesión es sin cuenta: lo de una cuenta sin perfil lo prueba
  // `tests/unit/seguridad/accion-sin-perfil.test.ts`.
  getIdentity: async () => null,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("next/cache", () => ({ refresh: () => undefined }));

const { crearLaOrdenManualDelPanel, buscarVariantes, buscarCompradores } =
  await import("@/modules/orders/actions-manual");
const { leerOrdenDelPanel } = await import("@/modules/orders/queries-panel");

function comoSesion(userId: string, role: "admin" | "customer") {
  sesion.actual = {
    identity: { userId, email: "ana@ejemplo.test", emailVerified: true },
    role,
    profile: {
      id: userId,
      email: "ana@ejemplo.test",
      isBanned: false,
      banReason: null,
      closureRequestedAt: null,
    },
  };
}

const creadas: number[] = [];

/** Lo mínimo que el formulario manda, para variar sólo lo que cada test mira. */
function loQueSeCarga(
  variantId: string,
  cambios: Record<string, unknown> = {},
) {
  return {
    items: [{ variantId, cantidad: 1, precio: "1000.00" }],
    estado: "finalizada" as const,
    fechaDeVenta: todayInArgentina(),
    nombre: "Rosa Pereyra",
    telefono: "2920555555",
    entrega: "retiro" as const,
    ...cambios,
  };
}

afterEach(async () => {
  sesion.actual = null;
  for (const numero of creadas.splice(0)) {
    await db.execute(sql`DELETE FROM orders WHERE order_number = ${numero}`);
  }
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

describe("quién puede cargar una venta", () => {
  test("sin sesión no se carga ni se busca nada", async () => {
    const { variantId } = await unaVariante({ total: 5 });

    expect(
      await crearLaOrdenManualDelPanel(loQueSeCarga(variantId)),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await buscarVariantes({ q: "teclado" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await buscarCompradores({ q: "rosa" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });

    expect(await contadores(variantId)).toMatchObject({ stockTotal: 5 });
  });

  test("un comprador tampoco: cargar ventas es del panel", async () => {
    const rosa = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    comoSesion(rosa.userId, "customer");
    expect(
      await crearLaOrdenManualDelPanel(loQueSeCarga(variantId)),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    // El buscador también: devuelve precios y stock de todo el catálogo.
    expect(await buscarVariantes({ q: "teclado" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
  });
});

describe("lo que escribe una persona (RF-24)", () => {
  test("la coma decimal se acepta y el email vacío se guarda en nulo", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    comoSesion(ana.userId, "admin");
    const r = await crearLaOrdenManualDelPanel(
      loQueSeCarga(variantId, {
        items: [{ variantId, cantidad: 2, precio: "1500,50" }],
        email: "",
      }),
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    creadas.push(r.data.numero);

    // «1500,50» es lo que escribe cualquiera en Argentina; pedirle que use
    // punto sería pedirle que escriba como la base.
    const quedo = (await leerOrdenDelPanel(r.data.numero))!;
    expect(quedo.total).toBe("3001.00");
    expect(quedo.customerEmail).toBeNull();
  });

  test("el teléfono es obligatorio, también acá (RF-05)", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    comoSesion(ana.userId, "admin");
    const r = await crearLaOrdenManualDelPanel(
      loQueSeCarga(variantId, { telefono: "" }),
    );

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  test("un precio negativo no es un descuento", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    comoSesion(ana.userId, "admin");
    const r = await crearLaOrdenManualDelPanel(
      loQueSeCarga(variantId, {
        items: [{ variantId, cantidad: 1, precio: "-100.00" }],
      }),
    );

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  test("sin renglones no hay orden", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const r = await crearLaOrdenManualDelPanel({
      items: [],
      estado: "finalizada",
      fechaDeVenta: todayInArgentina(),
      nombre: "Rosa Pereyra",
      telefono: "2920555555",
      entrega: "retiro",
    });

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("con envío, la dirección es obligatoria (RF-24)", () => {
  test("elegir envío y no escribirla no guarda nada", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    comoSesion(ana.userId, "admin");
    const r = await crearLaOrdenManualDelPanel(
      loQueSeCarga(variantId, { entrega: "envio" }),
    );

    // Sin la regla, la orden se guardaría sin dirección y §5.6 la leería como
    // un retiro: no sería un dato faltante, sería una orden que miente.
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await contadores(variantId)).toMatchObject({ stockTotal: 5 });
  });

  test("una localidad de fuera de la zona se rechaza (RN-10)", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    comoSesion(ana.userId, "admin");
    const r = await crearLaOrdenManualDelPanel(
      loQueSeCarga(variantId, {
        entrega: "envio",
        direccion: {
          recipientName: "Rosa Pereyra",
          phone: "2920555555",
          street: "Av. Siempreviva",
          number: "742",
          localidad: "Córdoba",
          otraLocalidad: "",
          provinciaDeOtra: "",
        },
      }),
    );

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  test("con la dirección completa, la orden guarda el snapshot y su código postal", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    comoSesion(ana.userId, "admin");
    const r = await crearLaOrdenManualDelPanel(
      loQueSeCarga(variantId, {
        entrega: "envio",
        direccion: {
          recipientName: "Rosa Pereyra",
          phone: "2920555555",
          street: "Av. Siempreviva",
          number: "742",
          apartment: "2 B",
          localidad: "Carmen de Patagones",
          otraLocalidad: "",
          provinciaDeOtra: "",
          notes: "Portón verde",
        },
      }),
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    creadas.push(r.data.numero);

    // La provincia y el CP NO se preguntan: se deducen de la localidad.
    const quedo = (await leerOrdenDelPanel(r.data.numero))!;
    expect(quedo.shippingAddress).toMatchObject({
      street: "Av. Siempreviva",
      number: "742",
      apartment: "2 B",
      city: "Carmen de Patagones",
      province: "Buenos Aires",
      postalCode: "8504",
      notes: "Portón verde",
    });
  });

  test("con retiro, la dirección que quedó escrita se ignora", async () => {
    const ana = await unComprador();
    const { variantId } = await unaVariante({ total: 5 });

    comoSesion(ana.userId, "admin");
    const r = await crearLaOrdenManualDelPanel(
      loQueSeCarga(variantId, {
        entrega: "retiro",
        // Se escribió, se cambió de opinión y se guardó: manda la elección.
        direccion: {
          recipientName: "Rosa Pereyra",
          phone: "2920555555",
          street: "Av. Siempreviva",
          number: "742",
          localidad: "Viedma",
          otraLocalidad: "",
          provinciaDeOtra: "",
        },
      }),
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    creadas.push(r.data.numero);

    expect(
      (await leerOrdenDelPanel(r.data.numero))!.shippingAddress,
    ).toBeNull();
  });
});

describe("los buscadores", () => {
  test("encuentran por nombre y traen los dos contadores", async () => {
    const ana = await unComprador();
    const { variantId, productId } = await unaVariante({
      total: 7,
      reservado: 2,
    });
    const [producto] = await db.execute<{ name: string }>(sql`
      SELECT name FROM products WHERE id = ${productId}`);

    comoSesion(ana.userId, "admin");
    const r = await buscarVariantes({ q: producto.name.slice(0, 12) });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const encontrada = r.data.resultados.find((v) => v.variantId === variantId);
    // Los dos, porque cada acción mira uno distinto (§8.1): finalizada
    // descuenta del stock y activa compromete el disponible.
    expect(encontrada).toMatchObject({ stock: 7, disponible: 5 });
  });

  test("el de compradores no ofrece cuentas bloqueadas ni en baja", async () => {
    const ana = await unComprador();
    const rosa = await unComprador();
    const otra = await unComprador();

    await db.execute(sql`
      UPDATE user_profiles
         SET is_banned = true, ban_reason = 'prueba'
       WHERE id = ${rosa.userId}`);
    await db.execute(sql`
      UPDATE user_profiles
         SET closure_requested_at = now(), closure_reason = 'prueba'
       WHERE id = ${otra.userId}`);

    comoSesion(ana.userId, "admin");
    const r = await buscarCompradores({ q: "Compradora" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.data.resultados.map((c) => c.id);
    // Asociarle una orden a una cuenta que está saliendo del sistema es
    // prometerle un «Mis compras» que no va a poder abrir (RF-27, RF-34).
    expect(ids).not.toContain(rosa.userId);
    expect(ids).not.toContain(otra.userId);
  });

  test("con menos de dos letras no busca nada", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const r = await buscarVariantes({ q: "a" });
    expect(r.ok && r.data.resultados).toEqual([]);
  });
});

/**
 * Una venta se puede cargar tarde: los reportes la cuentan en su día, no en el
 * de la carga.
 */
describe("la fecha de la venta (RF-24)", () => {
  /** `AAAA-MM-DD` de hace `dias` días, en Argentina. */
  function haceDias(dias: number): string {
    const [a, m, d] = todayInArgentina().split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10);
  }

  /** El día de una fecha guardada, en Argentina. */
  async function diaEnArgentina(iso: string): Promise<string> {
    const [fila] = await db.execute<{ dia: string }>(sql`
      SELECT to_char(${iso}::timestamptz AT TIME ZONE
               'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS dia`);
    return fila.dia;
  }

  async function cargar(variantId: string, cambios: Record<string, unknown>) {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");
    const r = await crearLaOrdenManualDelPanel(
      loQueSeCarga(variantId, cambios),
    );
    if (r.ok) creadas.push(r.data.numero);
    return r;
  }

  test("una venta de días atrás queda finalizada ese día, y cargada hoy", async () => {
    const { variantId } = await unaVariante({ total: 5 });
    const r = await cargar(variantId, { fechaDeVenta: haceDias(6) });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const orden = (await leerOrdenDelPanel(r.data.numero))!;
    expect(await diaEnArgentina(orden.finalizadaEn!)).toBe(haceDias(6));
    expect(await diaEnArgentina(orden.creadaEn)).toBe(todayInArgentina());
  });

  test("con la fecha de hoy, la venta es de ahora", async () => {
    const { variantId } = await unaVariante({ total: 5 });
    const antes = Date.now();
    const r = await cargar(variantId, {});

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const orden = (await leerOrdenDelPanel(r.data.numero))!;
    expect(new Date(orden.finalizadaEn!).getTime()).toBeGreaterThanOrEqual(
      antes - 5000,
    );
  });

  test("una fecha futura no se acepta", async () => {
    const { variantId } = await unaVariante({ total: 5 });
    const r = await cargar(variantId, { fechaDeVenta: haceDias(-1) });

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect((await contadores(variantId)).stockTotal).toBe(5);
  });

  test("finalizada sin fecha no se acepta", async () => {
    const { variantId } = await unaVariante({ total: 5 });
    const r = await cargar(variantId, { fechaDeVenta: undefined });

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  test("una activa ignora la fecha: su venta es cuando se finalice", async () => {
    const { variantId } = await unaVariante({ total: 5 });
    const r = await cargar(variantId, {
      estado: "activa",
      fechaDeVenta: haceDias(3),
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const orden = (await leerOrdenDelPanel(r.data.numero))!;
    expect(orden.finalizadaEn).toBeNull();
  });
});
