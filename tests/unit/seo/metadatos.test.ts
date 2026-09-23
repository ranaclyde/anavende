import { describe, expect, test } from "vitest";

import {
  aJson,
  migas,
  organizacion,
  producto,
  sitio,
} from "@/lib/datos-estructurados";
import { resumenDeMetadatos, urlAbsoluta } from "@/lib/seo";
import {
  catalogoIndexable,
  FILTROS_DE_TIENDA_VACIOS,
  urlDeTienda,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import type { Ficha } from "@/modules/catalog/products/ficha";

/**
 * F3.9 — RNF-04.
 *
 * **Todo lo de este archivo es silencioso cuando falla**, que es el motivo de
 * probarlo: un `canonical` de más, un `noindex` donde no va o un JSON-LD mal
 * armado no rompen ninguna pantalla, no aparecen en la consola y no se ven
 * mirando el sitio. Se enteraría Google, meses después.
 *
 * No toca la base: son funciones puras. Lo que sí la toca —el mapa del
 * sitio— está en `mapa-del-sitio.test.ts`.
 */

function unaFicha(cambios: Partial<Ficha> = {}): Ficha {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "teclado-mecanico",
    nombre: "Teclado mecánico",
    descripcion: "Un **teclado** mecánico.",
    descripcionTexto: "Un teclado mecánico.",
    marca: "Logitech",
    categoria: "Teclados",
    categoriaId: "22222222-2222-4222-8222-222222222222",
    precio: "50000.00",
    descuento: "5000.00",
    precioFinal: "45000.00",
    variantes: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        colorSlug: "negro",
        colorNombre: "Negro",
        colorHex: "#000000",
        disponible: 3,
        imagenes: [],
      },
    ],
    ...cambios,
  };
}

describe("resumenDeMetadatos", () => {
  test("aplasta los saltos de línea y los espacios repetidos", () => {
    // Es la forma exacta en que llega una descripción escrita en el panel:
    // con renglones. En un `<meta>` un renglón es un espacio.
    expect(resumenDeMetadatos("Un  teclado\n\n  mecánico ")).toBe(
      "Un teclado mecánico",
    );
  });

  test("lo que entra no se toca", () => {
    const corto = "Teclado mecánico de Logitech.";
    expect(resumenDeMetadatos(corto)).toBe(corto);
  });

  test("corta donde termina una palabra, no a los 155 exactos", () => {
    const largo = `${"palabra ".repeat(30)}final`;
    const resumen = resumenDeMetadatos(largo);

    expect(resumen.length).toBeLessThanOrEqual(155);
    expect(resumen.endsWith("…")).toBe(true);
    // Lo que importa: la última palabra está entera. Con un corte a secas
    // terminaría en «palab…».
    expect(resumen).toMatch(/palabra…$/);
  });

  test("no deja el signo de puntuación pegado a los puntos suspensivos", () => {
    const texto = `${"palabra ".repeat(18)}fin, y algo más largo todavía acá`;
    expect(resumenDeMetadatos(texto, 40)).not.toMatch(/[,\s]…$/);
  });

  test("una palabra sola larguísima se corta igual", () => {
    // Sin este caso, un texto sin espacios saldría entero: el corte por
    // palabra no encontraría dónde cortar y devolvería todo.
    const resumen = resumenDeMetadatos("a".repeat(400));
    expect(resumen.length).toBeLessThanOrEqual(155);
  });

  test("el vacío sigue vacío, para que el respaldo pueda elegirse con `||`", () => {
    expect(resumenDeMetadatos("   \n  ")).toBe("");
  });
});

describe("urlAbsoluta", () => {
  test("no duplica ni se come la barra", () => {
    expect(urlAbsoluta("/productos")).toMatch(/^https?:\/\/[^/]+\/productos$/);
    expect(urlAbsoluta("productos")).toBe(urlAbsoluta("/productos"));
  });
});

describe("catalogoIndexable", () => {
  const con = (cambios: Partial<FiltrosDeTienda>): FiltrosDeTienda => ({
    ...FILTROS_DE_TIENDA_VACIOS,
    ...cambios,
  });

  test("el catálogo sin tocar sí", () => {
    expect(catalogoIndexable(FILTROS_DE_TIENDA_VACIOS)).toBe(true);
  });

  test("la página 3 también: es contenido que no está en ninguna otra parte", () => {
    expect(catalogoIndexable(con({ pagina: 3 }))).toBe(true);
  });

  test("una búsqueda no", () => {
    expect(catalogoIndexable(con({ q: "teclado" }))).toBe(false);
  });

  test("ningún filtro puesto, ni el que no se ve en los chips", () => {
    expect(catalogoIndexable(con({ categoria: ["x"] }))).toBe(false);
    expect(catalogoIndexable(con({ marca: ["x"] }))).toBe(false);
    expect(catalogoIndexable(con({ color: ["x"] }))).toBe(false);
    expect(catalogoIndexable(con({ oferta: true }))).toBe(false);
    expect(catalogoIndexable(con({ precioMin: 1000 }))).toBe(false);
    expect(catalogoIndexable(con({ precioMax: 1000 }))).toBe(false);
  });

  test("otro orden tampoco: son los mismos productos dados vuelta", () => {
    expect(catalogoIndexable(con({ orden: "precio-asc" }))).toBe(false);
  });
});

describe("datos estructurados del producto", () => {
  test("el precio es el FINAL y viaja como lo guarda la base", () => {
    const datos = producto(unaFicha(), []) as {
      offers: { price: string; priceCurrency: string };
    };

    // Sin separador de miles, sin símbolo y con los dos decimales: es lo que
    // pide schema.org y lo que ya tiene la columna.
    expect(datos.offers.price).toBe("45000.00");
    expect(datos.offers.priceCurrency).toBe("ARS");
  });

  test("con stock en algún color está disponible", () => {
    const datos = producto(unaFicha(), []) as {
      offers: { availability: string };
    };
    expect(datos.offers.availability).toBe("https://schema.org/InStock");
  });

  test("el stock NEGATIVO es «no hay», no «hay»", () => {
    // RF-24: el disponible puede quedar negativo. Con una suma mirada como
    // `>= 0` esto diría que está disponible.
    const ficha = unaFicha();
    const datos = producto(
      {
        ...ficha,
        variantes: [{ ...ficha.variantes[0], disponible: -2 }],
      },
      [],
    ) as { offers: { availability: string } };

    expect(datos.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  test("un color agotado no tapa al que tiene stock", () => {
    const ficha = unaFicha();
    const datos = producto(
      {
        ...ficha,
        variantes: [
          { ...ficha.variantes[0], disponible: 0 },
          { ...ficha.variantes[0], id: "otra", disponible: 4 },
        ],
      },
      [],
    ) as { offers: { availability: string } };

    expect(datos.offers.availability).toBe("https://schema.org/InStock");
  });

  test("sin fotos no se declara la clave `image`", () => {
    // Un `image: []` es peor que no decir nada: declara que no tiene ninguna.
    expect(producto(unaFicha(), [])).not.toHaveProperty("image");
  });

  test("sin descripción no se declara la clave `description`", () => {
    const datos = producto(unaFicha({ descripcionTexto: "  " }), []);
    expect(datos).not.toHaveProperty("description");
  });
});

describe("migas", () => {
  test("son las tres de la pantalla, en orden y numeradas desde 1", () => {
    const datos = migas(unaFicha()) as {
      itemListElement: { position: number; name: string; item: string }[];
    };

    expect(datos.itemListElement.map((p) => p.name)).toEqual([
      "Catálogo",
      "Teclados",
      "Teclado mecánico",
    ]);
    expect(datos.itemListElement.map((p) => p.position)).toEqual([1, 2, 3]);
  });

  test("la categoría apunta a la MISMA dirección que el enlace de la miga", () => {
    const ficha = unaFicha();
    const datos = migas(ficha) as { itemListElement: { item: string }[] };

    expect(datos.itemListElement[1].item).toBe(
      urlAbsoluta(urlDeTienda({ categoria: [ficha.categoriaId] })),
    );
  });
});

describe("datos estructurados del sitio", () => {
  test("el buscador apunta a la búsqueda de verdad, con su parámetro", () => {
    const datos = sitio() as {
      potentialAction: { target: { urlTemplate: string } };
    };

    // Si `filtros-tienda.ts` cambiara el nombre del parámetro, esto lo dice.
    expect(datos.potentialAction.target.urlTemplate).toBe(
      urlAbsoluta("/productos?q={search_term_string}"),
    );
    expect(urlDeTienda({ q: "algo" })).toContain("q=algo");
  });

  test("la organización dice dónde entrega", () => {
    const datos = organizacion() as { areaServed: { name: string }[] };
    expect(datos.areaServed.map((c) => c.name)).toEqual([
      "Viedma",
      "Carmen de Patagones",
    ]);
  });
});

describe("aJson", () => {
  test("un `</script>` en un nombre no cierra la etiqueta", () => {
    // El caso real: la vendedora pega texto con HTML adentro de una
    // descripción. Sin el escape, todo lo que sigue deja de ser datos.
    const json = aJson(
      producto(
        unaFicha({ nombre: "Teclado </script><img src=x onerror=alert(1)>" }),
        [],
      ),
    );

    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<img");
    // Y sigue siendo el mismo dato: el escape es del transporte, no del texto.
    expect((JSON.parse(json) as { name: string }).name).toBe(
      "Teclado </script><img src=x onerror=alert(1)>",
    );
  });
});
