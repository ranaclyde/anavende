import { describe, expect, test } from "vitest";

import { paginasALaVista, tramo } from "@/lib/paginacion";

/**
 * La paginación única (2026-11-05): la de la tienda, que ahora recorta con
 * «…», y el tramo que el panel dice arriba de cada listado.
 */

describe("qué números se dibujan", () => {
  test("hasta 7 páginas, todas", () => {
    expect(paginasALaVista(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(paginasALaVista(3, 3)).toEqual([1, 2, 3]);
  });

  test("cerca del principio", () => {
    expect(paginasALaVista(1, 73)).toEqual([1, 2, 3, 4, 5, null, 73]);
    expect(paginasALaVista(4, 73)).toEqual([1, 2, 3, 4, 5, null, 73]);
  });

  test("en el medio, la actual con sus vecinas", () => {
    expect(paginasALaVista(5, 73)).toEqual([1, null, 4, 5, 6, null, 73]);
    expect(paginasALaVista(40, 73)).toEqual([1, null, 39, 40, 41, null, 73]);
  });

  test("cerca del final", () => {
    expect(paginasALaVista(70, 73)).toEqual([1, null, 69, 70, 71, 72, 73]);
    expect(paginasALaVista(73, 73)).toEqual([1, null, 69, 70, 71, 72, 73]);
  });

  test("siempre siete lugares, para que la barra no cambie de ancho", () => {
    for (let p = 1; p <= 30; p++)
      expect(paginasALaVista(p, 30)).toHaveLength(7);
  });
});

describe("el tramo del contador", () => {
  const cosa = { singular: "orden", plural: "órdenes" };

  test("con una sola página, cuántas hay", () => {
    expect(tramo({ pagina: 1, porPagina: 40, total: 12, cosa })).toBe(
      "12 órdenes",
    );
    expect(tramo({ pagina: 1, porPagina: 40, total: 1, cosa })).toBe("1 orden");
    expect(tramo({ pagina: 1, porPagina: 40, total: 40, cosa })).toBe(
      "40 órdenes",
    );
  });

  test("con más, qué tramo se mira", () => {
    expect(tramo({ pagina: 1, porPagina: 40, total: 95, cosa })).toBe(
      "Del 1 al 40 de 95 órdenes",
    );
    expect(tramo({ pagina: 3, porPagina: 40, total: 95, cosa })).toBe(
      "Del 81 al 95 de 95 órdenes",
    );
  });
});
