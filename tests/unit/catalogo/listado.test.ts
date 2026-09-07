import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { brands, categories, colors, products } from "@/db/schema";
import {
  DIRECCION_NATURAL,
  FILTROS_VACIOS,
  hayFiltros,
  leerFiltros,
  sinFiltros,
  urlDeFiltros,
  urlDeOrden,
} from "@/modules/catalog/products/filtros";
import {
  contarProductos,
  listarProductos,
} from "@/modules/catalog/products/queries";
import { umbralDeStockBajo } from "@/modules/settings/queries";

/**
 * F2.5 — RF-15, RF-20, §10.2.
 *
 * Migrado de `scripts/verificar-listado.mts` (F4.0b).
 *
 * Lo que se prueba es lo que NO se ve leyendo el código:
 *
 *   · Que los tres números de stock salgan de la SUMA de las variantes,
 *     incluido el caso que no se nota: un color en −3 y otro en +10 suman 7,
 *     así que la discrepancia de RF-24 hay que contarla por variante o
 *     desaparece.
 *   · Que el filtro de stock viva en HAVING y no en WHERE. En WHERE se evalúa
 *     variante por variante, y un producto con un color en cero y otro con
 *     diez aparecería como «sin stock».
 *   · Que `%` y `_` sean lo que dicen y no comodines.
 *   · Que la URL sobreviva a que alguien la edite a mano.
 */

type Filtros = Parameters<typeof listarProductos>[0];

const con = (cambios: Partial<Filtros>): Filtros => ({
  ...FILTROS_VACIOS,
  ...cambios,
});

describe("la URL (§10.2)", () => {
  test("sin parámetros quedan los valores de siempre", () => {
    expect(leerFiltros({}).orden).toBe("destacados");
    expect(leerFiltros({}).dir).toBe(DIRECCION_NATURAL.destacados);
  });

  test("un valor que no existe se descarta en vez de romper la pantalla", () => {
    // Toda la lectura de la URL parte de que alguien la va a editar a mano, o
    // a compartir una vieja: caerse ahí sería caerse por un enlace.
    expect(leerFiltros({ orden: "carisimo", estado: "borrados" }).orden).toBe(
      "destacados",
    );
    expect(leerFiltros({ estado: "borrados" }).estado).toBe("todos");
  });

  test("lo que no tiene forma de UUID no llega a la consulta", () => {
    expect(leerFiltros({ marca: "hola" }).marca).toBe("");
    expect(leerFiltros({ categoria: "1; DROP TABLE" }).categoria).toBe("");
  });

  test("un parámetro repetido toma el primero, no falla", () => {
    expect(leerFiltros({ q: ["uno", "dos"] }).q).toBe("uno");
  });

  test("cada orden arranca por su dirección natural: la fecha por lo último", () => {
    expect(leerFiltros({ orden: "fecha" }).dir).toBe("desc");
    expect(leerFiltros({ orden: "nombre" }).dir).toBe("asc");
  });

  test("…y la dirección de la URL manda sobre la natural", () => {
    expect(leerFiltros({ orden: "fecha", dir: "asc" }).dir).toBe("asc");
  });

  test("un listado sin tocar es /admin/productos a secas", () => {
    expect(urlDeFiltros(FILTROS_VACIOS)).toBe("/admin/productos");
  });

  test("la dirección natural no se escribe: la URL dice solo lo que se cambió", () => {
    expect(urlDeFiltros(con({ orden: "fecha", dir: "desc" }))).toBe(
      "/admin/productos?orden=fecha",
    );
  });

  test("volver a ordenar por la misma columna da vuelta la dirección", () => {
    expect(urlDeOrden(con({ orden: "precio", dir: "asc" }), "precio")).toBe(
      "/admin/productos?orden=precio&dir=desc",
    );
  });

  test("cambiar de columna arranca por su dirección natural, no hereda la anterior", () => {
    expect(urlDeOrden(con({ orden: "fecha", dir: "asc" }), "precio")).toBe(
      "/admin/productos?orden=precio",
    );
  });

  test("el orden no es un filtro: «Limpiar todo» aparece por búsqueda o filtros", () => {
    expect(hayFiltros(con({ orden: "precio" }))).toBe(false);
    expect(hayFiltros(con({ q: "algo" }))).toBe(true);
  });

  test("limpiar los filtros conserva el orden elegido", () => {
    expect(
      sinFiltros(con({ q: "algo", orden: "precio", dir: "desc" })).orden,
    ).toBe("precio");
  });
});

/**
 * El catálogo de prueba se arma UNA vez y lo comparten todas las lecturas de
 * abajo: son consultas, no mutaciones, así que rearmarlo por test sería el
 * mismo resultado quince veces más lento.
 *
 * Cada nombre lleva el sufijo `marca` —un timestamp—, y buscar por ese sufijo
 * es lo que aísla estos productos de los que ya haya en la base local.
 */
describe("contra la base", () => {
  const marca = String(Date.now());

  const creado = {
    productos: [] as string[],
    marcas: [] as string[],
    categorias: [] as string[],
    colores: [] as string[],
  };

  let teclado = "";
  let cable = "";
  let mouse = "";
  let monitor = "";
  let auricular = "";
  let marcaA = "";
  let marcaB = "";
  let catA = "";
  let catB = "";

  async function unaFila(consulta: ReturnType<typeof sql>) {
    const [f] = await db.execute<{ id: string }>(consulta);
    return f.id;
  }

  async function producto(
    nombre: string,
    o: {
      brand: string;
      cat: string;
      price: string;
      descripcion?: string;
      destacado?: boolean;
      activo?: boolean;
      dias?: number;
    },
  ) {
    const slug = `${nombre}-${marca}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = await unaFila(sql`
      INSERT INTO products (name, slug, description, brand_id, category_id, price,
                            is_featured, is_active, created_at)
      VALUES (${nombre}, ${slug}, ${o.descripcion ?? ""}, ${o.brand}, ${o.cat},
              ${o.price}, ${o.destacado ?? false}, ${o.activo ?? true},
              now() - make_interval(days => ${o.dias ?? 0}))
      RETURNING id`);
    creado.productos.push(id);
    return id;
  }

  const variante = (
    productId: string,
    colorId: string | null,
    total: number,
    reservado = 0,
  ) =>
    db.execute(sql`
      INSERT INTO product_variants (product_id, color_id, stock_total, reserved_stock)
      VALUES (${productId}, ${colorId}, ${total}, ${reservado})`);

  beforeAll(async () => {
    marcaA = await unaFila(sql`
      INSERT INTO brands (name, slug)
      VALUES (${`Lojitech ${marca}`}, ${`lojitech-${marca}`}) RETURNING id`);
    marcaB = await unaFila(sql`
      INSERT INTO brands (name, slug)
      VALUES (${`Otramarca ${marca}`}, ${`otramarca-${marca}`}) RETURNING id`);
    creado.marcas.push(marcaA, marcaB);

    catA = await unaFila(sql`
      INSERT INTO categories (name, slug)
      VALUES (${`Teclados ${marca}`}, ${`teclados-${marca}`}) RETURNING id`);
    catB = await unaFila(sql`
      INSERT INTO categories (name, slug)
      VALUES (${`Cables ${marca}`}, ${`cables-${marca}`}) RETURNING id`);
    creado.categorias.push(catA, catB);

    const negro = await unaFila(sql`
      INSERT INTO colors (name, slug, hex_code)
      VALUES (${`Negro ${marca}`}, ${`negro-${marca}`}, '#000000') RETURNING id`);
    const blanco = await unaFila(sql`
      INSERT INTO colors (name, slug, hex_code)
      VALUES (${`Blanco ${marca}`}, ${`blanco-${marca}`}, '#FFFFFF') RETURNING id`);
    creado.colores.push(negro, blanco);

    // Un teclado destacado con stock de sobra.
    teclado = await producto(`Teclado Mecánico ${marca}`, {
      brand: marcaA, cat: catA, price: "10000.00", destacado: true, dias: 3,
    });
    await variante(teclado, negro, 10, 2);

    // Un cable barato cuya descripción es la única que nombra «USB-C».
    cable = await producto(`Cable ${marca}`, {
      brand: marcaA, cat: catB, price: "500.00", dias: 2,
      descripcion: "Compatible con **USB-C** y 50% más rápido.",
    });
    await variante(cable, negro, 2);

    // Un mouse inactivo y sin nada disponible.
    mouse = await producto(`Mouse ${marca}`, {
      brand: marcaB, cat: catA, price: "3000.00", activo: false, dias: 1,
    });
    await variante(mouse, negro, 0);

    // Un monitor con un color en negativo y otro con stock: la discrepancia
    // que la suma esconde (RF-24, §5.4).
    monitor = await producto(`Monitor ${marca}`, {
      brand: marcaB, cat: catB, price: "80000.00", dias: 0,
    });
    await variante(monitor, negro, -3);
    await variante(monitor, blanco, 10);

    // Recién cargado, todavía sin colores. F2.4 hace el alta en dos pasos, así
    // que este estado existe de verdad y no es un caso inventado.
    auricular = await producto(`Auricular ${marca}`, {
      brand: marcaA, cat: catA, price: "7000.00", dias: 4,
    });
  });

  /**
   * Se borra con el constructor de Drizzle y no con SQL a mano: en una
   * plantilla `sql`, un array de JS se expande como LISTA DE PARÁMETROS
   * —`($1, $2, …)`— y no como un array de Postgres, así que `= ANY(...)`
   * falla con «requires array on right side». `inArray` arma el `IN` bien.
   *
   * El orden importa: los productos referencian marca y categoría con
   * RESTRICT, así que primero se van ellos.
   */
  afterAll(async () => {
    if (creado.productos.length) {
      await db.delete(products).where(inArray(products.id, creado.productos));
    }
    await db.delete(colors).where(inArray(colors.id, creado.colores));
    await db.delete(brands).where(inArray(brands.id, creado.marcas));
    await db.delete(categories).where(inArray(categories.id, creado.categorias));
  });

  /** Solo nuestros productos, por el sufijo del nombre. */
  const ids = async (f: Partial<Filtros> = {}) =>
    (
      await listarProductos(
        con({ q: marca, marca: "", categoria: "", ...f }),
        3,
      )
    ).map((p) => p.id);

  describe("el stock sale de la suma de las variantes", () => {
    test("total, reservado y disponible por producto (RF-15): 10, 2 y 8", async () => {
      const todos = await listarProductos(con({ q: marca }), 3);
      expect(todos.find((p) => p.id === teclado)).toMatchObject({
        stockTotal: 10,
        reservado: 2,
        disponible: 8,
      });
    });

    test("un color en −3 y otro en +10 suman 7: el total esconde la discrepancia", async () => {
      const todos = await listarProductos(con({ q: marca }), 3);
      const m = todos.find((p) => p.id === monitor)!;
      expect(m).toMatchObject({ stockTotal: 7, disponible: 7 });
      // Por eso se cuenta aparte: el producto queda marcado igual, y sin este
      // contador la discrepancia de RF-24 no se ve en ninguna pantalla.
      expect(m.variantesEnNegativo).toBe(1);
    });

    test("un producto sin colores no tiene stock, y se distingue de tenerlo en cero", async () => {
      const todos = await listarProductos(con({ q: marca }), 3);
      expect(todos.find((p) => p.id === auricular)).toMatchObject({
        variantes: 0,
        disponible: 0,
      });
    });
  });

  describe("la búsqueda (§10.1, la mitad por subcadena)", () => {
    test("el término se busca entero: «teclado cable» no es «teclado» o «cable»", async () => {
      expect(
        await listarProductos(con({ q: "teclado cable", marca: marcaA }), 3),
      ).toHaveLength(0);
    });

    test("«mecanico» encuentra «Mecánico»: no depende de los acentos", async () => {
      const r = await listarProductos(con({ q: "mecanico", marca: marcaA }), 3);
      expect(r.map((p) => p.id)).toContain(teclado);
    });

    test("buscar por el nombre de la marca trae sus tres productos", async () => {
      expect(
        await listarProductos(con({ q: `lojitech ${marca}` }), 3),
      ).toHaveLength(3);
    });

    test("la descripción también se busca, y el guion de «USB-C» sobrevive", async () => {
      const r = await listarProductos(con({ q: "usb-c", marca: marcaA }), 3);
      expect(r.map((p) => p.id)).toEqual([cable]);
    });

    /**
     * `%` y `_` son comodines de ILIKE. Si el término no se escapa, buscar
     * «%» devuelve el catálogo entero y buscar «cabl_» trae «cable»: la
     * búsqueda parecería andar mejor de lo que anda, hasta que alguien busca
     * un porcentaje de verdad.
     */
    test("«%» busca un por ciento, no todo", async () => {
      const r = await listarProductos(con({ q: "%", marca: marcaA }), 3);
      expect(r.map((p) => p.id)).toEqual([cable]);
    });

    test("el guion bajo tampoco es un comodín", async () => {
      expect(
        await listarProductos(con({ q: "cabl_", marca: marcaA }), 3),
      ).toHaveLength(0);
    });
  });

  describe("los filtros (RF-15)", () => {
    test("por categoría", async () => {
      expect((await ids({ categoria: catB })).sort()).toEqual(
        [cable, monitor].sort(),
      );
    });

    test("por marca", async () => {
      expect((await ids({ marca: marcaB })).sort()).toEqual(
        [mouse, monitor].sort(),
      );
    });

    test("por estado: el único inactivo", async () => {
      expect(await ids({ estado: "inactivos" })).toEqual([mouse]);
    });

    test("…y los otros cuatro siguen siendo los activos", async () => {
      expect(await ids({ estado: "activos" })).toHaveLength(4);
    });
  });

  describe("el stock como filtro (RF-20)", () => {
    test("«sin stock» son el que tiene cero y el que no tiene colores", async () => {
      expect((await ids({ stock: "sin" })).sort()).toEqual(
        [mouse, auricular].sort(),
      );
    });

    /**
     * El corazón de la tarea: el filtro vive en HAVING, sobre la suma. En
     * WHERE se evaluaría variante por variante y el monitor —un color en −3,
     * otro con 10— entraría en «sin stock» teniendo diez unidades en el
     * depósito.
     */
    test("el monitor NO es «sin stock» aunque tenga un color en cero o menos", async () => {
      expect(await ids({ stock: "sin" })).not.toContain(monitor);
    });

    test("«para reponer» agrega lo que está en el umbral o por debajo (2 ≤ 3)", async () => {
      expect((await ids({ stock: "reponer" })).sort()).toEqual(
        [mouse, auricular, cable].sort(),
      );
    });

    test("con el umbral en 1, el cable de 2 unidades ya no hace falta reponerlo", async () => {
      const r = await listarProductos(con({ q: marca, stock: "reponer" }), 1);
      expect(r).toHaveLength(2);
    });
  });

  describe("el orden (RF-15)", () => {
    const nombres = async (f: Partial<Filtros>) =>
      (await listarProductos(con({ q: marca, ...f }), 3)).map(
        (p) => p.name.split(" ")[0],
      );

    test("por nombre, de la A a la Z, y al revés", async () => {
      expect(await nombres({ orden: "nombre", dir: "asc" })).toEqual([
        "Auricular", "Cable", "Monitor", "Mouse", "Teclado",
      ]);
      expect(await nombres({ orden: "nombre", dir: "desc" })).toEqual([
        "Teclado", "Mouse", "Monitor", "Cable", "Auricular",
      ]);
    });

    test("por precio, en los dos sentidos", async () => {
      expect((await nombres({ orden: "precio", dir: "asc" }))[0]).toBe("Cable");
      expect((await nombres({ orden: "precio", dir: "desc" }))[0]).toBe("Monitor");
    });

    test("por stock disponible: primero lo que no queda", async () => {
      expect(
        (await nombres({ orden: "stock", dir: "asc" })).slice(0, 2).sort(),
      ).toEqual(["Auricular", "Mouse"]);
    });

    test("por fecha de carga, primero lo último", async () => {
      expect((await nombres({ orden: "fecha", dir: "desc" }))[0]).toBe("Monitor");
      expect((await nombres({ orden: "fecha", dir: "asc" }))[0]).toBe("Auricular");
    });

    test("destacados primero, y después por nombre", async () => {
      expect((await nombres({ orden: "destacados" }))[0]).toBe("Teclado");
    });
  });

  describe("lo que separa «vacío» de «sin resultados» (§8)", () => {
    /**
     * `contarProductos()` ignora los filtros a propósito: es lo que decide si
     * la pantalla dice «todavía no cargaste nada» o «no hay resultados para
     * esta búsqueda». Con el conteo filtrado, un catálogo lleno con una
     * búsqueda sin resultados diría que está vacío.
     */
    test("el total cuenta todos los productos, sin mirar los filtros", async () => {
      expect(await contarProductos()).toBeGreaterThanOrEqual(5);
    });

    test("el umbral sale de site_settings, y sin fila es 3", async () => {
      const [fila] = await db.execute<{ u: number }>(
        sql`SELECT low_stock_threshold AS u FROM site_settings WHERE id = 1`,
      );
      expect(await umbralDeStockBajo()).toBe(fila?.u ?? 3);
    });
  });
});
