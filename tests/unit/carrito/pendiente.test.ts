import { randomUUID } from "node:crypto";

import { describe, expect, test } from "vitest";

import { interpretar } from "@/modules/cart/pendiente";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";

/**
 * F5.7 — la compra que quedó pendiente de iniciar sesión. RF-08.
 *
 * Lo que se prueba acá es **lo único que esta tarea agrega y que no es la
 * cookie ni la pantalla**: cómo se lee lo que vuelve del navegador. Agregar
 * al carrito ya está probado en `operaciones.test.ts` y no cambia por venir
 * de una nota; la cookie en sí la escribe y la borra Next, y lo que hay que
 * mirar es que un valor manipulado no se convierta en una compra.
 *
 * **Nada de lo que llega del navegador se cree.** La cookie es `httpOnly`,
 * así que la escribe el servidor y no debería poder tocarse desde la página;
 * «no debería» no es una garantía, y una extensión, otra pestaña o un cliente
 * escrito a mano pueden mandar cualquier cosa. Un valor que no pasa el
 * esquema se ignora en silencio, que es lo correcto: la ficha se dibuja
 * igual, con su botón de siempre.
 */

const variantId = randomUUID();

describe("una nota que se puede usar", () => {
  test("vuelve tal como se guardó", () => {
    expect(interpretar(JSON.stringify({ variantId, cantidad: 3 }))).toEqual({
      variantId,
      cantidad: 3,
    });
  });

  test("el tope por renglón entra justo", () => {
    expect(
      interpretar(JSON.stringify({ variantId, cantidad: TOPE_POR_ITEM })),
    ).toEqual({ variantId, cantidad: TOPE_POR_ITEM });
  });
});

describe("una nota que no sirve se ignora", () => {
  test("sin cookie no hay nada pendiente", () => {
    expect(interpretar(undefined)).toBeNull();
    expect(interpretar("")).toBeNull();
  });

  test("lo que no es JSON no rompe la ficha", () => {
    expect(interpretar("{esto no es json")).toBeNull();
    expect(interpretar("null")).toBeNull();
    expect(interpretar("[]")).toBeNull();
  });

  test("un id que no es un uuid no llega a la base", () => {
    expect(
      interpretar(JSON.stringify({ variantId: "1 OR 1=1", cantidad: 1 })),
    ).toBeNull();
  });

  test("una cantidad fuera de rango no se recorta, se descarta", () => {
    // Recortar sería agregar algo distinto de lo que se pidió, sin decirlo.
    for (const cantidad of [0, -5, 1.5, TOPE_POR_ITEM + 1, "2", null]) {
      expect(interpretar(JSON.stringify({ variantId, cantidad }))).toBeNull();
    }
  });

  test("le falta la mitad", () => {
    expect(interpretar(JSON.stringify({ variantId }))).toBeNull();
    expect(interpretar(JSON.stringify({ cantidad: 2 }))).toBeNull();
  });
});
