import { describe, expect, test } from "vitest";

import { visiblePages, rangeLabel } from "@/lib/pagination";

/**
 * La paginación única (2026-11-05): la de la tienda, que ahora recorta con
 * «…», y el tramo que el panel dice arriba de cada listado.
 */

describe("qué números se dibujan", () => {
  test("hasta 7 páginas, todas", () => {
    expect(visiblePages(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(visiblePages(3, 3)).toEqual([1, 2, 3]);
  });

  test("cerca del principio", () => {
    expect(visiblePages(1, 73)).toEqual([1, 2, 3, 4, 5, null, 73]);
    expect(visiblePages(4, 73)).toEqual([1, 2, 3, 4, 5, null, 73]);
  });

  test("en el medio, la actual con sus vecinas", () => {
    expect(visiblePages(5, 73)).toEqual([1, null, 4, 5, 6, null, 73]);
    expect(visiblePages(40, 73)).toEqual([1, null, 39, 40, 41, null, 73]);
  });

  test("cerca del final", () => {
    expect(visiblePages(70, 73)).toEqual([1, null, 69, 70, 71, 72, 73]);
    expect(visiblePages(73, 73)).toEqual([1, null, 69, 70, 71, 72, 73]);
  });

  test("siempre siete lugares, para que la barra no cambie de ancho", () => {
    for (let p = 1; p <= 30; p++) expect(visiblePages(p, 30)).toHaveLength(7);
  });
});

describe("el tramo del contador", () => {
  const cosa = { singular: "orden", plural: "órdenes" };

  test("con una sola página, cuántas hay", () => {
    expect(rangeLabel({ page: 1, perPage: 40, total: 12, noun: cosa })).toBe(
      "12 órdenes",
    );
    expect(rangeLabel({ page: 1, perPage: 40, total: 1, noun: cosa })).toBe(
      "1 orden",
    );
    expect(rangeLabel({ page: 1, perPage: 40, total: 40, noun: cosa })).toBe(
      "40 órdenes",
    );
  });

  test("con más, qué tramo se mira", () => {
    expect(rangeLabel({ page: 1, perPage: 40, total: 95, noun: cosa })).toBe(
      "Del 1 al 40 de 95 órdenes",
    );
    expect(rangeLabel({ page: 3, perPage: 40, total: 95, noun: cosa })).toBe(
      "Del 81 al 95 de 95 órdenes",
    );
  });
});
