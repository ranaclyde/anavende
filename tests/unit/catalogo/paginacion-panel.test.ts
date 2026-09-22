import { describe, expect, test } from "vitest";

import {
  cuantasPaginas,
  leerPaginaDeCatalogo,
  POR_PAGINA,
  urlDePagina,
} from "@/modules/catalog/filtros-panel";
import {
  listarCategorias,
  listarColores,
  listarMarcas,
} from "@/modules/catalog/queries";
import { listarMediosDePago } from "@/modules/settings/queries";

/**
 * La paginación de las cuatro pantallas de Catálogo — §6.9, §10.2. 2026-09-18.
 *
 * Lo que se prueba no es que pagine —con 3 o 4 filas y un tope de 40 no hay
 * segunda página— sino las dos cosas que ROMPEN cuando aparezca: que el total
 * sea el de la tabla y no el del arreglo, y que pedir una página que no existe
 * devuelva vacío en vez de fallar.
 */

const LISTADOS = [
  ["marcas", listarMarcas],
  ["categorías", listarCategorias],
  ["colores", listarColores],
  ["medios de pago", listarMediosDePago],
] as const;

describe("la URL de una página", () => {
  test("la primera no se escribe: el listado sin tocar es la ruta a secas", () => {
    expect(urlDePagina("/admin/catalogo/marcas", 1)).toBe(
      "/admin/catalogo/marcas",
    );
    expect(urlDePagina("/admin/catalogo/marcas", 3)).toBe(
      "/admin/catalogo/marcas?pagina=3",
    );
  });

  test("lo que no es una página se descarta en vez de romper la pantalla", () => {
    expect(leerPaginaDeCatalogo({})).toBe(1);
    expect(leerPaginaDeCatalogo({ pagina: "0" })).toBe(1);
    expect(leerPaginaDeCatalogo({ pagina: "-4" })).toBe(1);
    expect(leerPaginaDeCatalogo({ pagina: "hola" })).toBe(1);
    // Un decimal se TRUNCA, no se descarta: `parseInt` corta en el punto. Es
    // la conducta que ya tenían los otros tres listados —sale de la misma
    // `pagina()` de `lib/filtros-url`— y no molesta: `?pagina=2.5` lleva a la
    // 2, que es la única lectura razonable de eso.
    expect(leerPaginaDeCatalogo({ pagina: "2.5" })).toBe(2);
    // Un parámetro repetido llega como arreglo y se toma el primero.
    expect(leerPaginaDeCatalogo({ pagina: ["7", "9"] })).toBe(7);
  });

  test("sin filas hay una página, no cero", () => {
    // Con cero, «Página 1 de 0» y el guardia de la pantalla mandaría a la 0.
    expect(cuantasPaginas(0)).toBe(1);
    expect(cuantasPaginas(POR_PAGINA)).toBe(1);
    expect(cuantasPaginas(POR_PAGINA + 1)).toBe(2);
  });
});

describe.each(LISTADOS)("el listado de %s", (_nombre, listar) => {
  test("el total es el de la tabla, no el largo de la página", async () => {
    const { items, total } = await listar(1);
    expect(typeof total).toBe("number");
    expect(total).toBeGreaterThanOrEqual(items.length);
    expect(items.length).toBeLessThanOrEqual(POR_PAGINA);
  });

  test("una página que no existe da vacío, y el total no cambia", async () => {
    const { total } = await listar(1);
    const lejos = await listar(999);
    expect(lejos.items).toHaveLength(0);
    // El total tiene que seguir en pie: es lo que usa la pantalla para mandar
    // a la última página que sí existe.
    expect(lejos.total).toBe(total);
  });
});
