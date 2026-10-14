import { randomUUID } from "node:crypto";

import { describe, expect, test } from "vitest";

import {
  FILTROS_DE_TIENDA_VACIOS,
  MAXIMO_POR_FILTRO,
  alternar,
  contarFiltrosDeTienda,
  hayFiltrosDeTienda,
  leerFiltrosDeTienda,
  urlCambiando,
  urlDePagina,
  urlDeTienda,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";

/**
 * F3.4 — RF-02, §10.2.
 *
 * **Esta es la única fuente del estado del catálogo**, y hasta hoy no tenía
 * un solo test: lo que se lee de la dirección y lo que se escribe en ella
 * tienen que ser la misma cosa, y cuando no lo son el síntoma no es un error
 * sino un filtro que queda puesto y no se puede sacar.
 *
 * Lo que se prueba es lo que no se ve leyendo el módulo: que un parámetro
 * repetido llegue como lista, que la basura pegada en la barra de direcciones
 * no llegue a Postgres, que el tope de valores exista de verdad, y que ir y
 * volver por la URL no pierda ni invente nada.
 */

// Slugs, como desde el 2026-10-14: `?marca=logitech`.
const A = "logitech";
const B = "hyperx";
const C = "cooler-master";

/** Los parámetros de una URL, tal como los entrega Next. */
function params(url: string): Record<string, string | string[]> {
  const busqueda = new URL(url, "http://x").searchParams;
  const salida: Record<string, string | string[]> = {};
  for (const clave of new Set(busqueda.keys())) {
    const valores = busqueda.getAll(clave);
    salida[clave] = valores.length > 1 ? valores : valores[0];
  }
  return salida;
}

describe("multiselección", () => {
  test("un parámetro repetido llega como lista, en orden", () => {
    const f = leerFiltrosDeTienda({ marca: [A, B] });
    expect(f.marca).toEqual([A, B]);
  });

  test("uno solo también, sin obligar a quien llama a envolverlo", () => {
    expect(leerFiltrosDeTienda({ marca: A }).marca).toEqual([A]);
  });

  test("los repetidos se descartan: dos veces la misma marca es una", () => {
    expect(leerFiltrosDeTienda({ marca: [A, B, A] }).marca).toEqual([A, B]);
  });

  test("los slugs se normalizan a minúsculas", () => {
    // Los slugs se guardan en minúscula, y el chip compara por igualdad: en
    // mayúsculas el filtro quedaría aplicado y sin chip que lo saque.
    expect(leerFiltrosDeTienda({ color: A.toUpperCase() }).color).toEqual([A]);
  });

  test("lo que no tiene forma de slug se descarta y no llega a la consulta", () => {
    // La forma de `slugificar`: minúsculas, números y guiones simples, hasta
    // 60. Lo demás no puede ser una marca, y no hace falta preguntárselo a la
    // base.
    const f = leerFiltrosDeTienda({
      marca: [
        "cooler master",
        A,
        "'; DROP TABLE products; --",
        "-logitech",
        "logi--tech",
        "x".repeat(61),
      ],
    });
    expect(f.marca).toEqual([A]);
  });

  test("hay un tope de valores por filtro", () => {
    const muchos = Array.from({ length: MAXIMO_POR_FILTRO + 15 }, () =>
      randomUUID(),
    );
    expect(leerFiltrosDeTienda({ marca: muchos }).marca).toHaveLength(
      MAXIMO_POR_FILTRO,
    );
  });

  test("`alternar` pone, saca, y respeta el tope", () => {
    expect(alternar([], A)).toEqual([A]);
    expect(alternar([A, B], C)).toEqual([A, B, C]);
    // Volver a tocar el chip encendido lo apaga.
    expect(alternar([A, B], A)).toEqual([B]);

    const lleno = Array.from({ length: MAXIMO_POR_FILTRO }, () => randomUUID());
    expect(alternar(lleno, A)).toHaveLength(MAXIMO_POR_FILTRO);
    // Pero sacar uno de una lista llena sigue funcionando.
    expect(alternar(lleno, lleno[0])).toHaveLength(MAXIMO_POR_FILTRO - 1);
  });
});

describe("rango de precio", () => {
  test("se leen los dos bordes", () => {
    const f = leerFiltrosDeTienda({ precioMin: "5000", precioMax: "20000" });
    expect([f.precioMin, f.precioMax]).toEqual([5000, 20000]);
  });

  test("un borde solo es válido", () => {
    expect(leerFiltrosDeTienda({ precioMin: "5000" }).precioMax).toBeNull();
    expect(leerFiltrosDeTienda({ precioMax: "5000" }).precioMin).toBeNull();
  });

  test("un rango al revés se da vuelta en vez de descartarse", () => {
    const f = leerFiltrosDeTienda({ precioMin: "20000", precioMax: "5000" });
    expect([f.precioMin, f.precioMax]).toEqual([5000, 20000]);
  });

  test("lo que no es un número se descarta", () => {
    expect(
      leerFiltrosDeTienda({ precioMin: "cinco mil" }).precioMin,
    ).toBeNull();
    expect(leerFiltrosDeTienda({ precioMin: "" }).precioMin).toBeNull();
    expect(leerFiltrosDeTienda({ precioMin: "-100" }).precioMin).toBeNull();
  });

  test("un número más grande que la columna se descarta", () => {
    // `numeric(12,2)` admite diez dígitos enteros, y `formatMoney` —que pinta
    // el chip— tira una excepción con once. Sin este corte, `?precioMax=` con
    // once dígitos rompe la página en vez de no filtrar nada.
    expect(leerFiltrosDeTienda({ precioMax: "9999999999" }).precioMax).toBe(
      9_999_999_999,
    );
    expect(
      leerFiltrosDeTienda({ precioMax: "99999999999" }).precioMax,
    ).toBeNull();
  });
});

describe("la dirección", () => {
  test("un catálogo sin tocar es `/productos` a secas", () => {
    expect(urlDeTienda({})).toBe("/productos");
  });

  test("los multivalor se escriben repetidos", () => {
    const url = urlDeTienda({ marca: [A, B] });
    expect(params(url).marca).toEqual([A, B]);
  });

  test("ida y vuelta: lo que se escribe es lo que se lee", () => {
    const original: FiltrosDeTienda = {
      q: "teclado mecánico",
      categoria: [A],
      marca: [B, C],
      color: [A, C],
      precioMin: 5000,
      precioMax: 20000,
      oferta: true,
      orden: "precio-desc",
      pagina: 3,
    };
    expect(leerFiltrosDeTienda(params(urlDeTienda(original)))).toEqual(
      original,
    );
  });

  test("cambiar un filtro vuelve a la página 1", () => {
    const f = { ...FILTROS_DE_TIENDA_VACIOS, pagina: 4 };
    expect(params(urlCambiando(f, { marca: [A] })).pagina).toBeUndefined();
  });

  test("cambiar de página conserva todo lo demás", () => {
    const f: FiltrosDeTienda = {
      ...FILTROS_DE_TIENDA_VACIOS,
      marca: [A, B],
      precioMax: 9000,
      orden: "nombre",
    };
    const p = params(urlDePagina(f, 2));
    expect(p.marca).toEqual([A, B]);
    expect(p.precioMax).toBe("9000");
    expect(p.orden).toBe("nombre");
    expect(p.pagina).toBe("2");
  });
});

describe("el contador del botón «Filtros»", () => {
  const con = (cambio: Partial<FiltrosDeTienda>): FiltrosDeTienda => ({
    ...FILTROS_DE_TIENDA_VACIOS,
    ...cambio,
  });

  test("cuenta valores y no grupos", () => {
    // Contando grupos, sacar una de las dos marcas dejaría el número quieto y
    // parecería que el clic no hizo nada.
    expect(contarFiltrosDeTienda(con({ marca: [A, B] }))).toBe(2);
    expect(contarFiltrosDeTienda(con({ marca: [A], color: [B, C] }))).toBe(3);
  });

  test("la búsqueda no cuenta, porque tiene su propio campo a la vista", () => {
    expect(contarFiltrosDeTienda(con({ q: "teclado" }))).toBe(0);
    expect(hayFiltrosDeTienda(con({ q: "teclado" }))).toBe(true);
  });

  test("el precio cuenta una vez, tenga uno o dos bordes", () => {
    expect(contarFiltrosDeTienda(con({ precioMin: 100 }))).toBe(1);
    expect(contarFiltrosDeTienda(con({ precioMin: 100, precioMax: 900 }))).toBe(
      1,
    );
  });

  test("sin nada puesto no hay nada que limpiar", () => {
    expect(hayFiltrosDeTienda(FILTROS_DE_TIENDA_VACIOS)).toBe(false);
    expect(hayFiltrosDeTienda(con({ precioMax: 1 }))).toBe(true);
  });
});
