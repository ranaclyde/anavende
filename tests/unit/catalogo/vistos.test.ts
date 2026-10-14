import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { tarjetasDeVistos } from "@/modules/catalog/products/vistos";
import {
  leerIds,
  MAXIMO_DE_VISTOS,
  sumarVisto,
} from "@/modules/catalog/products/vistos-cookie";
import { enTransaccionRevertida, type Tx } from "@/tests/apoyo/transaccion";

/**
 * F8.4 — RF-33, TS §11.3: «Vistos recientemente».
 *
 * Dos mitades. La cookie, que la escribe el navegador y por eso se lee sin
 * confiar en ella. Y la consulta, que tiene que respetar el orden de la lista
 * —el más reciente primero— y mostrar lo vigente, no lo de la visita.
 */

const id = () => randomUUID();

describe("la cookie", () => {
  test("lo nuevo va primero, y lo repetido sube en vez de duplicarse", () => {
    const [a, b, c] = [id(), id(), id()];
    let valor = sumarVisto(undefined, a);
    valor = sumarVisto(valor, b);
    valor = sumarVisto(valor, c);
    valor = sumarVisto(valor, a);

    expect(leerIds(valor)).toEqual([a, c, b]);
  });

  test("guarda los últimos diez", () => {
    const ids = Array.from({ length: 12 }, id);
    const valor = ids.reduce<string | undefined>(sumarVisto, undefined);

    expect(leerIds(valor)).toEqual(ids.reverse().slice(0, MAXIMO_DE_VISTOS));
  });

  test("descarta lo que no es un id, venga de donde venga", () => {
    const a = id();
    expect(leerIds(`${a}.basura.' OR 1=1.${a}`)).toEqual([a]);
    expect(leerIds("")).toEqual([]);
    expect(leerIds(undefined)).toEqual([]);
  });
});

async function preparar(tx: Tx) {
  const sufijo = randomUUID().slice(0, 8);
  const [m] = await tx.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug) VALUES (${`Marca ${sufijo}`}, ${`marca-${sufijo}`})
    RETURNING id`);
  const [c] = await tx.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug) VALUES (${`Rubro ${sufijo}`}, ${`rubro-${sufijo}`})
    RETURNING id`);

  return async (nombre: string, precio = 1000, activo = true) => {
    const [p] = await tx.execute<{ id: string }>(sql`
      INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
      VALUES (${nombre}, ${`${nombre}-${sufijo}`.toLowerCase()}, ${m.id}, ${c.id},
              ${precio.toFixed(2)}, ${activo})
      RETURNING id`);
    return p.id;
  };
}

const nombres = (lista: { nombre: string }[]) => lista.map((p) => p.nombre);

describe("tarjetasDeVistos", () => {
  test("en el orden de la lista, sin inactivos ni el que se está viendo", () =>
    enTransaccionRevertida(async (tx) => {
      const producto = await preparar(tx);
      const a = await producto("A");
      const b = await producto("B");
      const c = await producto("C");
      const inactivo = await producto("Inactivo", 1000, false);

      const lista = [c, inactivo, a, b, id()];
      expect(nombres(await tarjetasDeVistos(lista, null, tx))).toEqual([
        "C",
        "A",
        "B",
      ]);
      expect(nombres(await tarjetasDeVistos(lista, a, tx))).toEqual(["C", "B"]);
    }));

  test("el precio es el de ahora, no el de la visita", () =>
    enTransaccionRevertida(async (tx) => {
      const producto = await preparar(tx);
      const a = await producto("A", 27500);
      const b = await producto("B");
      await tx.execute(sql`UPDATE products SET price = 24500 WHERE id = ${a}`);

      const [tarjeta] = await tarjetasDeVistos([a, b], null, tx);
      expect(Number(tarjeta.precioFinal)).toBe(24500);
    }));

  test("con menos de dos para mostrar, no hay bloque", () =>
    enTransaccionRevertida(async (tx) => {
      const producto = await preparar(tx);
      const a = await producto("A");
      const b = await producto("B");
      const inactivo = await producto("Inactivo", 1000, false);

      expect(await tarjetasDeVistos([a], null, tx)).toEqual([]);
      // Dos en la lista, pero uno es el que se está viendo.
      expect(await tarjetasDeVistos([a, b], a, tx)).toEqual([]);
      // Dos en la lista, pero uno ya no se vende.
      expect(await tarjetasDeVistos([a, inactivo], null, tx)).toEqual([]);
    }));
});
