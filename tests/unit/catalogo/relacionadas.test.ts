import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { guardarRelaciones } from "@/modules/catalog/relaciones";
import { motivoDel } from "@/tests/apoyo/errores";
import { enTransaccionRevertida, type Tx } from "@/tests/apoyo/transaccion";

/**
 * F8.1 — RF-31, TS §11.1: las categorías relacionadas y su reciprocidad.
 *
 * Se prueba `guardarRelaciones` y no la Server Action —eso necesita sesión—,
 * porque lo que puede salir mal está acá: que una recíproca no cree la
 * inversa, que destildarla no la borre, o que quitar una dirigida se lleve la
 * del otro lado. Ninguna de las tres da error: dan recomendaciones de más o
 * de menos, que nadie ve hasta que mira una ficha.
 */

async function unaCategoria(
  tx: Tx,
  nombre: string,
  activa = true,
): Promise<string> {
  const [f] = await tx.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug, is_active)
    VALUES (${`Rel ${nombre}`}, ${`rel-${nombre.toLowerCase()}`}, ${activa})
    RETURNING id`);
  return f.id;
}

/** Las filas que salen de `id`, en su orden: `[otra, recíproca]`. */
async function relacionesDe(tx: Tx, id: string) {
  const filas = await tx.execute<{ otra: string; reciproca: boolean }>(sql`
    SELECT related_category_id AS otra, is_reciprocal AS reciproca
      FROM category_relations
     WHERE category_id = ${id}
     ORDER BY sort_order`);
  return filas.map((f) => [f.otra, f.reciproca]);
}

async function falla(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    return motivoDel(e);
  }
  throw new Error("se aceptó, y no debía");
}

describe("guardarRelaciones", () => {
  test("una recíproca crea las dos filas; una dirigida, una sola", () =>
    enTransaccionRevertida(async (tx) => {
      const teclados = await unaCategoria(tx, "Teclados");
      const pads = await unaCategoria(tx, "Pads");
      const fundas = await unaCategoria(tx, "Fundas");

      await guardarRelaciones(tx, teclados, [
        { id: pads, reciproca: true },
        { id: fundas, reciproca: false },
      ]);

      expect(await relacionesDe(tx, teclados)).toEqual([
        [pads, true],
        [fundas, false],
      ]);
      expect(await relacionesDe(tx, pads)).toEqual([[teclados, true]]);
      expect(await relacionesDe(tx, fundas)).toEqual([]);
    }));

  test("la inversa entra al final de la otra lista, sin desordenarla", () =>
    enTransaccionRevertida(async (tx) => {
      const pads = await unaCategoria(tx, "Pads");
      const mouses = await unaCategoria(tx, "Mouses");
      const auris = await unaCategoria(tx, "Auris");
      const teclados = await unaCategoria(tx, "Teclados");

      await guardarRelaciones(tx, pads, [
        { id: mouses, reciproca: false },
        { id: auris, reciproca: false },
      ]);
      await guardarRelaciones(tx, teclados, [{ id: pads, reciproca: true }]);

      expect(await relacionesDe(tx, pads)).toEqual([
        [mouses, false],
        [auris, false],
        [teclados, true],
      ]);
    }));

  test("el orden de la lista es el que se guarda", () =>
    enTransaccionRevertida(async (tx) => {
      const teclados = await unaCategoria(tx, "Teclados");
      const pads = await unaCategoria(tx, "Pads");
      const mouses = await unaCategoria(tx, "Mouses");

      await guardarRelaciones(tx, teclados, [
        { id: pads, reciproca: true },
        { id: mouses, reciproca: true },
      ]);
      await guardarRelaciones(tx, teclados, [
        { id: mouses, reciproca: true },
        { id: pads, reciproca: true },
      ]);

      expect(await relacionesDe(tx, teclados)).toEqual([
        [mouses, true],
        [pads, true],
      ]);
    }));

  test("destildar «Recíproca» borra la inversa y deja la propia", () =>
    enTransaccionRevertida(async (tx) => {
      const notebooks = await unaCategoria(tx, "Notebooks");
      const fundas = await unaCategoria(tx, "Fundas");

      await guardarRelaciones(tx, notebooks, [{ id: fundas, reciproca: true }]);
      await guardarRelaciones(tx, notebooks, [
        { id: fundas, reciproca: false },
      ]);

      expect(await relacionesDe(tx, notebooks)).toEqual([[fundas, false]]);
      expect(await relacionesDe(tx, fundas)).toEqual([]);
    }));

  test("quitar una recíproca la quita de los dos lados", () =>
    enTransaccionRevertida(async (tx) => {
      const teclados = await unaCategoria(tx, "Teclados");
      const pads = await unaCategoria(tx, "Pads");

      await guardarRelaciones(tx, teclados, [{ id: pads, reciproca: true }]);
      // Desde el OTRO lado: la relación es una sola, se mire de donde se mire.
      await guardarRelaciones(tx, pads, []);

      expect(await relacionesDe(tx, teclados)).toEqual([]);
      expect(await relacionesDe(tx, pads)).toEqual([]);
    }));

  test("quitar una dirigida no toca la dirigida de vuelta", () =>
    enTransaccionRevertida(async (tx) => {
      const a = await unaCategoria(tx, "A");
      const b = await unaCategoria(tx, "B");

      await guardarRelaciones(tx, a, [{ id: b, reciproca: false }]);
      await guardarRelaciones(tx, b, [{ id: a, reciproca: false }]);
      await guardarRelaciones(tx, b, []);

      expect(await relacionesDe(tx, a)).toEqual([[b, false]]);
      expect(await relacionesDe(tx, b)).toEqual([]);
    }));

  test("una recíproca sobre una dirigida de vuelta la vuelve recíproca", () =>
    enTransaccionRevertida(async (tx) => {
      const notebooks = await unaCategoria(tx, "Notebooks");
      const fundas = await unaCategoria(tx, "Fundas");

      await guardarRelaciones(tx, notebooks, [
        { id: fundas, reciproca: false },
      ]);
      await guardarRelaciones(tx, fundas, [{ id: notebooks, reciproca: true }]);

      expect(await relacionesDe(tx, notebooks)).toEqual([[fundas, true]]);
      expect(await relacionesDe(tx, fundas)).toEqual([[notebooks, true]]);
    }));

  test("no se agrega una inactiva, pero una que ya estaba se conserva", () =>
    enTransaccionRevertida(async (tx) => {
      const teclados = await unaCategoria(tx, "Teclados");
      const pads = await unaCategoria(tx, "Pads");
      const vieja = await unaCategoria(tx, "Vieja", false);

      expect(
        await falla(() =>
          tx.transaction((sp) =>
            guardarRelaciones(sp, teclados, [{ id: vieja, reciproca: true }]),
          ),
        ),
      ).toMatch(/inactiva/);

      await guardarRelaciones(tx, teclados, [{ id: pads, reciproca: true }]);
      await tx.execute(
        sql`UPDATE categories SET is_active = false WHERE id = ${pads}`,
      );
      // Guardar de nuevo con la misma lista no la rechaza: desactivar la
      // otra no puede dejar a esta sin poder editarse.
      await guardarRelaciones(tx, teclados, [{ id: pads, reciproca: true }]);

      expect(await relacionesDe(tx, teclados)).toEqual([[pads, true]]);
    }));

  test("una categoría no se relaciona consigo misma", () =>
    enTransaccionRevertida(async (tx) => {
      const teclados = await unaCategoria(tx, "Teclados");

      expect(
        await falla(() =>
          guardarRelaciones(tx, teclados, [{ id: teclados, reciproca: true }]),
        ),
      ).toMatch(/consigo misma/);
    }));

  test("borrar una categoría se lleva sus relaciones de los dos lados", () =>
    enTransaccionRevertida(async (tx) => {
      const teclados = await unaCategoria(tx, "Teclados");
      const pads = await unaCategoria(tx, "Pads");

      await guardarRelaciones(tx, teclados, [{ id: pads, reciproca: true }]);
      await tx.execute(sql`DELETE FROM categories WHERE id = ${pads}`);

      expect(await relacionesDe(tx, teclados)).toEqual([]);
    }));
});
