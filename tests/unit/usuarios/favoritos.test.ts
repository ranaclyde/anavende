import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { desmarcar, marcar } from "@/modules/users/favoritos/operaciones";
import { interpretar } from "@/modules/users/favoritos/pendiente";
import { interpretarVista } from "@/modules/users/favoritos/vista";
import {
  esFavorito,
  idsDeFavoritos,
  leerFavoritos,
} from "@/modules/users/favoritos/queries";
import { limpiar, unaVariante, unProducto } from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * F5.4 — favoritos. RF-10 · §5.5, §13.8.
 *
 * El favorito es del PRODUCTO (decisión del 2026-09-14). Que un visitante no
 * pueda guardar lo sostiene el envoltorio de §6.2, probado desde F1.10.
 */

afterEach(async () => {
  await limpiarCompradores();
  await limpiar();
});

async function desactivar(productId: string): Promise<void> {
  await db.execute(sql`UPDATE products SET is_active = false WHERE id = ${productId}`);
}

describe("guardar y quitar", () => {
  test("guardar dos veces no es un error, y queda guardado una vez", async () => {
    const { userId } = await unComprador();
    const productId = await unProducto();

    await marcar(userId, productId);
    await marcar(userId, productId);

    expect(await idsDeFavoritos(userId)).toEqual([productId]);
    expect(await esFavorito(userId, productId)).toBe(true);
  });

  test("un producto desactivado o inexistente no se puede guardar", async () => {
    const { userId } = await unComprador();
    const productId = await unProducto();
    await desactivar(productId);

    for (const id of [productId, randomUUID()]) {
      await expect(marcar(userId, id)).rejects.toMatchObject({
        code: "PRODUCT_UNAVAILABLE",
        message: "Ese producto ya no está disponible.",
      });
    }
    expect(await idsDeFavoritos(userId)).toEqual([]);
  });

  test("quitar, y quitar lo que no está no es un error", async () => {
    const { userId } = await unComprador();
    const productId = await unProducto();
    await marcar(userId, productId);

    expect(await desmarcar(userId, productId)).toEqual({ quitado: true });
    expect(await desmarcar(userId, productId)).toEqual({ quitado: false });
    expect(await esFavorito(userId, productId)).toBe(false);
  });

  test("lo que se desactivó después se puede quitar igual", async () => {
    const { userId } = await unComprador();
    const productId = await unProducto();
    await marcar(userId, productId);
    await desactivar(productId);

    expect(await desmarcar(userId, productId)).toEqual({ quitado: true });
  });
});

describe("aislamiento (§13.8)", () => {
  test("un comprador no ve ni quita los favoritos de otro", async () => {
    const ana = await unComprador();
    const otra = await unComprador();
    const productId = await unProducto();
    await marcar(ana.userId, productId);

    expect(await desmarcar(otra.userId, productId)).toEqual({ quitado: false });
    expect(await idsDeFavoritos(otra.userId)).toEqual([]);
    expect(await esFavorito(otra.userId, productId)).toBe(false);
    expect(await leerFavoritos(otra.userId)).toEqual({ favoritos: [], total: 0 });

    expect(await esFavorito(ana.userId, productId)).toBe(true);
  });
});

describe("la lista", () => {
  test("último guardado primero, con precio y stock vigentes", async () => {
    const { userId } = await unComprador();
    const viejo = await unaVariante({ total: 3 });
    const nuevo = await unaVariante({ total: 0 });

    await marcar(userId, viejo.productId);
    await marcar(userId, nuevo.productId);
    // Las dos altas pueden caer en el mismo instante; el orden no puede
    // depender de eso.
    await db.execute(sql`
      UPDATE favorites SET created_at = now() - interval '1 minute'
       WHERE user_id = ${userId} AND product_id = ${viejo.productId}`);

    // RF-10: el precio es el de ahora, no el de cuando se guardó.
    await db.execute(sql`
      UPDATE products SET price = '2500.00' WHERE id = ${viejo.productId}`);

    const { favoritos: lista, total } = await leerFavoritos(userId);

    expect(total).toBe(2);
    expect(lista.map((f) => f.id)).toEqual([nuevo.productId, viejo.productId]);
    expect(lista[1]).toMatchObject({ precio: "2500.00", disponible: 3, activo: true });
    expect(lista[0]).toMatchObject({ disponible: 0, activo: true });
  });

  test("lo desactivado sigue en la lista, marcado como no activo", async () => {
    const { userId } = await unComprador();
    const productId = await unProducto();
    await marcar(userId, productId);
    await desactivar(productId);

    expect((await leerFavoritos(userId)).favoritos).toMatchObject([
      { id: productId, activo: false },
    ]);
  });

  test("se pagina: cada página trae lo suyo y el total es de todas", async () => {
    const { userId } = await unComprador();
    const ids = [await unProducto(), await unProducto(), await unProducto()];
    for (const [i, id] of ids.entries()) {
      await marcar(userId, id);
      // El primero es el más viejo: el orden no depende de que las altas
      // caigan en instantes distintos.
      await db.execute(sql`
        UPDATE favorites SET created_at = now() - make_interval(mins => ${10 - i})
         WHERE user_id = ${userId} AND product_id = ${id}`);
    }

    const primera = await leerFavoritos(userId, { pagina: 1, porPagina: 2 });
    const segunda = await leerFavoritos(userId, { pagina: 2, porPagina: 2 });
    const tercera = await leerFavoritos(userId, { pagina: 3, porPagina: 2 });

    expect(primera.favoritos.map((f) => f.id)).toEqual([ids[2], ids[1]]);
    expect(segunda.favoritos.map((f) => f.id)).toEqual([ids[0]]);
    expect(tercera).toEqual({ favoritos: [], total: 3 });
    expect(primera.total).toBe(3);
  });
});

describe("la vista (lista o tarjetas)", () => {
  test("lista por omisión, y lo que no es una vista conocida también", () => {
    expect(interpretarVista(undefined)).toBe("lista");
    expect(interpretarVista("cualquier-cosa")).toBe("lista");
    expect(interpretarVista("lista")).toBe("lista");
    expect(interpretarVista("tarjetas")).toBe("tarjetas");
  });
});

describe("favorito pendiente (RF-05)", () => {
  test("de la cookie solo vale un uuid; lo demás se ignora", () => {
    const id = randomUUID();

    expect(interpretar(id)).toBe(id);
    expect(interpretar(undefined)).toBeNull();
    expect(interpretar("")).toBeNull();
    expect(interpretar("no-es-un-uuid")).toBeNull();
    expect(interpretar(JSON.stringify({ productId: id }))).toBeNull();
  });
});
