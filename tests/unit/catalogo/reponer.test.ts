import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import {
  contadores,
  limpiar,
  movimientos,
  unaVariante,
  unProducto,
} from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * El globo de «Reponer» escribe varias variantes de una vez. Se prueba que sea
 * una sola transacción, que cada ajuste asiente su movimiento (§8.3) y que no
 * se pueda mover el stock de otro producto: `productId` y `variantId` llegan
 * los dos del cliente.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { leerParaReponer, reponerStock } =
  await import("@/modules/catalog/variants/actions");

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

const colores: string[] = [];

afterEach(async () => {
  sesion.actual = null;
  await limpiarCompradores();
  await limpiar();
  for (const id of colores.splice(0)) {
    await db.execute(sql`DELETE FROM colors WHERE id = ${id}`);
  }
});

/**
 * Los colores se crean acá y no se toman del seed: con un `OFFSET`, el archivo
 * dependería de que la base traiga por lo menos dos.
 */
async function unProductoConDosColores(
  a: { total: number; reservado?: number },
  b: { total: number; reservado?: number },
) {
  const productId = await unProducto();

  const unColor = async () => {
    const sufijo = crypto.randomUUID().slice(0, 8);
    const [c] = await db.execute<{ id: string }>(sql`
      INSERT INTO colors (name, slug, hex_code)
      VALUES (${`Prueba ${sufijo}`}, ${`prueba-${sufijo}`}, '#123456')
      RETURNING id`);
    colores.push(c.id);
    return c.id;
  };

  const insertar = async (
    s: { total: number; reservado?: number },
    colorId: string,
  ) => {
    const [v] = await db.execute<{ id: string }>(sql`
      INSERT INTO product_variants
        (product_id, color_id, stock_total, reserved_stock)
      VALUES (${productId}, ${colorId}, ${s.total}, ${s.reservado ?? 0})
      RETURNING id`);
    return v.id;
  };

  return {
    productId,
    primera: await insertar(a, await unColor()),
    segunda: await insertar(b, await unColor()),
  };
}

describe("quién puede reponer (§6.2)", () => {
  test("un comprador no puede, ni leer ni escribir", async () => {
    const { productId, variantId } = await unaVariante({ total: 5 });
    const comprador = await unComprador();
    comoSesion(comprador.userId, "customer");

    expect((await leerParaReponer({ productId })).ok).toBe(false);
    const r = await reponerStock({
      productId,
      ajustes: [{ variantId, nuevoTotal: 99 }],
    });
    expect(r.ok).toBe(false);
    expect((await contadores(variantId)).stockTotal).toBe(5);
  });
});

describe("reponer (RF-16)", () => {
  test("escribe los dos colores y asienta un movimiento por cada uno", async () => {
    const admin = await unComprador();
    await db.execute(
      sql`UPDATE user_profiles SET role = 'admin' WHERE id = ${admin.userId}`,
    );
    comoSesion(admin.userId, "admin");

    const { productId, primera, segunda } = await unProductoConDosColores(
      { total: 2 },
      { total: 10 },
    );

    const r = await reponerStock({
      productId,
      ajustes: [
        { variantId: primera, nuevoTotal: 7 },
        { variantId: segunda, nuevoTotal: 12 },
      ],
    });

    expect(r.ok).toBe(true);
    expect((await contadores(primera)).stockTotal).toBe(7);
    expect((await contadores(segunda)).stockTotal).toBe(12);

    const asientos = await movimientos(primera);
    expect(asientos).toHaveLength(1);
    expect(asientos[0].quantity).toBe(5);
    expect(asientos[0].stockAfter).toBe(7);
    expect(asientos[0].note).toBe("Reposición desde el listado");
  });

  test("el color que no cambió no ensucia el libro", async () => {
    const admin = await unComprador();
    await db.execute(
      sql`UPDATE user_profiles SET role = 'admin' WHERE id = ${admin.userId}`,
    );
    comoSesion(admin.userId, "admin");

    const { productId, primera, segunda } = await unProductoConDosColores(
      { total: 2 },
      { total: 10 },
    );

    // El globo manda siempre las dos, hayan cambiado o no.
    await reponerStock({
      productId,
      ajustes: [
        { variantId: primera, nuevoTotal: 7 },
        { variantId: segunda, nuevoTotal: 10 },
      ],
    });

    expect(await movimientos(primera)).toHaveLength(1);
    expect(await movimientos(segunda)).toHaveLength(0);
  });

  test("si un color es rechazado, el otro NO queda guardado", async () => {
    const admin = await unComprador();
    await db.execute(
      sql`UPDATE user_profiles SET role = 'admin' WHERE id = ${admin.userId}`,
    );
    comoSesion(admin.userId, "admin");

    // La segunda tiene 4 reservadas: bajarla a 1 se rechaza.
    const { productId, primera, segunda } = await unProductoConDosColores(
      { total: 2 },
      { total: 10, reservado: 4 },
    );

    const r = await reponerStock({
      productId,
      ajustes: [
        { variantId: primera, nuevoTotal: 50 },
        { variantId: segunda, nuevoTotal: 1 },
      ],
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("no puede bajar de 4");

    // La primera, válida y antes en la lista, tampoco se guardó.
    expect((await contadores(primera)).stockTotal).toBe(2);
    expect((await contadores(segunda)).stockTotal).toBe(10);
    expect(await movimientos(primera)).toHaveLength(0);
  });

  test("no se puede mover el stock de una variante de otro producto", async () => {
    const admin = await unComprador();
    await db.execute(
      sql`UPDATE user_profiles SET role = 'admin' WHERE id = ${admin.userId}`,
    );
    comoSesion(admin.userId, "admin");

    const mio = await unaVariante({ total: 1 });
    const ajeno = await unaVariante({ total: 5 });

    const r = await reponerStock({
      productId: mio.productId,
      ajustes: [{ variantId: ajeno.variantId, nuevoTotal: 999 }],
    });

    expect(r.ok).toBe(false);
    expect((await contadores(ajeno.variantId)).stockTotal).toBe(5);
  });

  test("el stock negativo se rechaza antes de llegar a la base (RF-16)", async () => {
    const admin = await unComprador();
    await db.execute(
      sql`UPDATE user_profiles SET role = 'admin' WHERE id = ${admin.userId}`,
    );
    comoSesion(admin.userId, "admin");

    const { productId, variantId } = await unaVariante({ total: 3 });
    const r = await reponerStock({
      productId,
      ajustes: [{ variantId, nuevoTotal: -1 }],
    });

    expect(r.ok).toBe(false);
    expect((await contadores(variantId)).stockTotal).toBe(3);
  });
});

describe("lo que el globo lee", () => {
  test("trae los colores con su reservado y su disponible", async () => {
    const admin = await unComprador();
    await db.execute(
      sql`UPDATE user_profiles SET role = 'admin' WHERE id = ${admin.userId}`,
    );
    comoSesion(admin.userId, "admin");

    const { productId } = await unProductoConDosColores(
      { total: 10, reservado: 4 },
      { total: 3 },
    );

    const r = await leerParaReponer({ productId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.data.variantes).toHaveLength(2);
    const conReservas = r.data.variantes.find((v) => v.reservedStock === 4)!;
    expect(conReservas.stockTotal).toBe(10);
    expect(conReservas.disponible).toBe(6);
    expect(conReservas.colorName).not.toBeNull();
  });
});
