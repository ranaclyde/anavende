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
  contarPorEstado,
  listarProductos,
} from "@/modules/catalog/products/queries";
import { umbralDeStockBajo } from "@/modules/settings/queries";

type Filtros = Parameters<typeof listarProductos>[0];

const con = (cambios: Partial<Filtros>): Filtros => ({
  ...FILTROS_VACIOS,
  ...cambios,
});

const filas = async (...args: Parameters<typeof listarProductos>) =>
  (await listarProductos(...args)).productos;

describe("la URL (§10.2)", () => {
  test("sin parámetros quedan los valores de siempre", () => {
    expect(leerFiltros({}).orden).toBe("destacados");
    expect(leerFiltros({}).dir).toBe(DIRECCION_NATURAL.destacados);
  });

  test("un valor que no existe se descarta en vez de romper la pantalla", () => {
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

  /** Estar en una solapa no es un filtro: si contara, «Limpiar todo» cambiaría de solapa sola. */
  test("la solapa tampoco es un filtro: no enciende «Limpiar todo»", () => {
    expect(hayFiltros(con({ estado: "inactivos" }))).toBe(false);
    expect(hayFiltros(con({ stock: "reponer" }))).toBe(true);
  });

  test("«Limpiar todo» conserva la solapa y borra lo demás", () => {
    const limpio = sinFiltros(
      con({ q: "algo", stock: "sin", estado: "inactivos", pagina: 4 }),
    );
    expect(limpio.estado).toBe("inactivos");
    expect(limpio.q).toBe("");
    expect(limpio.stock).toBe("todos");
    expect(limpio.pagina).toBe(1);
  });

  /** El parámetro se sigue llamando `estado`: es el que enlaza el tablero. */
  test("el enlace de cada solapa conserva la búsqueda y los filtros", () => {
    expect(urlDeFiltros(con({ estado: "activos", stock: "reponer" }))).toBe(
      "/admin/productos?estado=activos&stock=reponer",
    );
  });
});

/**
 * El catálogo se arma una vez y lo comparten todas las lecturas. El sufijo
 * `marca` en cada nombre lo aísla de lo que ya haya en la base local.
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

    teclado = await producto(`Teclado Mecánico ${marca}`, {
      brand: marcaA,
      cat: catA,
      price: "10000.00",
      destacado: true,
      dias: 3,
    });
    await variante(teclado, negro, 10, 2);

    // La única descripción que nombra «USB-C».
    cable = await producto(`Cable ${marca}`, {
      brand: marcaA,
      cat: catB,
      price: "500.00",
      dias: 2,
      descripcion: "Compatible con **USB-C** y 50% más rápido.",
    });
    await variante(cable, negro, 2);

    mouse = await producto(`Mouse ${marca}`, {
      brand: marcaB,
      cat: catA,
      price: "3000.00",
      activo: false,
      dias: 1,
    });
    await variante(mouse, negro, 0);

    // Un color en negativo y otro con stock: la discrepancia que la suma
    // esconde (RF-24).
    monitor = await producto(`Monitor ${marca}`, {
      brand: marcaB,
      cat: catB,
      price: "80000.00",
      dias: 0,
    });
    await variante(monitor, negro, -3);
    await variante(monitor, blanco, 10);

    // Sin colores: el alta en dos pasos deja este estado de verdad.
    auricular = await producto(`Auricular ${marca}`, {
      brand: marcaA,
      cat: catA,
      price: "7000.00",
      dias: 4,
    });
  });

  /**
   * Con `inArray` y no con SQL a mano: en `sql`, un array de JS se expande
   * como lista de parámetros y `= ANY(...)` falla. Los productos van primero
   * porque referencian marca y categoría con RESTRICT.
   */
  afterAll(async () => {
    if (creado.productos.length) {
      await db.delete(products).where(inArray(products.id, creado.productos));
    }
    await db.delete(colors).where(inArray(colors.id, creado.colores));
    await db.delete(brands).where(inArray(brands.id, creado.marcas));
    await db
      .delete(categories)
      .where(inArray(categories.id, creado.categorias));
  });

  /** Solo nuestros productos, por el sufijo del nombre. */
  const ids = async (f: Partial<Filtros> = {}) =>
    (await filas(con({ q: marca, marca: "", categoria: "", ...f }), 3)).map(
      (p) => p.id,
    );

  describe("el stock sale de la suma de las variantes", () => {
    test("total, reservado y disponible por producto (RF-15): 10, 2 y 8", async () => {
      const todos = await filas(con({ q: marca }), 3);
      expect(todos.find((p) => p.id === teclado)).toMatchObject({
        stockTotal: 10,
        reservado: 2,
        disponible: 8,
      });
    });

    test("un color en −3 y otro en +10 suman 7: el total esconde la discrepancia", async () => {
      const todos = await filas(con({ q: marca }), 3);
      const m = todos.find((p) => p.id === monitor)!;
      expect(m).toMatchObject({ stockTotal: 7, disponible: 7 });
      // Sin este contador la discrepancia no se ve en ninguna pantalla.
      expect(m.variantesEnNegativo).toBe(1);
    });

    test("un producto sin colores no tiene stock, y se distingue de tenerlo en cero", async () => {
      const todos = await filas(con({ q: marca }), 3);
      expect(todos.find((p) => p.id === auricular)).toMatchObject({
        variantes: 0,
        disponible: 0,
      });
    });
  });

  describe("la búsqueda (§10.1, la mitad por subcadena)", () => {
    test("el término se busca entero: «teclado cable» no es «teclado» o «cable»", async () => {
      expect(
        await filas(con({ q: "teclado cable", marca: marcaA }), 3),
      ).toHaveLength(0);
    });

    test("«mecanico» encuentra «Mecánico»: no depende de los acentos", async () => {
      const r = await filas(con({ q: "mecanico", marca: marcaA }), 3);
      expect(r.map((p) => p.id)).toContain(teclado);
    });

    test("buscar por el nombre de la marca trae sus tres productos", async () => {
      expect(await filas(con({ q: `lojitech ${marca}` }), 3)).toHaveLength(3);
    });

    test("la descripción también se busca, y el guion de «USB-C» sobrevive", async () => {
      const r = await filas(con({ q: "usb-c", marca: marcaA }), 3);
      expect(r.map((p) => p.id)).toEqual([cable]);
    });

    /** `%` y `_` son comodines de ILIKE: sin escaparlos, «%» trae todo y «cabl_» trae «cable». */
    test("«%» busca un por ciento, no todo", async () => {
      const r = await filas(con({ q: "%", marca: marcaA }), 3);
      expect(r.map((p) => p.id)).toEqual([cable]);
    });

    test("el guion bajo tampoco es un comodín", async () => {
      expect(await filas(con({ q: "cabl_", marca: marcaA }), 3)).toHaveLength(
        0,
      );
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
     * El filtro vive en HAVING, sobre la suma: en WHERE el monitor entraría
     * en «sin stock» teniendo diez unidades.
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
      const r = await filas(con({ q: marca, stock: "reponer" }), 1);
      expect(r).toHaveLength(2);
    });
  });

  describe("el orden (RF-15)", () => {
    const nombres = async (f: Partial<Filtros>) =>
      (await filas(con({ q: marca, ...f }), 3)).map(
        (p) => p.name.split(" ")[0],
      );

    test("por nombre, de la A a la Z, y al revés", async () => {
      expect(await nombres({ orden: "nombre", dir: "asc" })).toEqual([
        "Auricular",
        "Cable",
        "Monitor",
        "Mouse",
        "Teclado",
      ]);
      expect(await nombres({ orden: "nombre", dir: "desc" })).toEqual([
        "Teclado",
        "Mouse",
        "Monitor",
        "Cable",
        "Auricular",
      ]);
    });

    test("por precio, en los dos sentidos", async () => {
      expect((await nombres({ orden: "precio", dir: "asc" }))[0]).toBe("Cable");
      expect((await nombres({ orden: "precio", dir: "desc" }))[0]).toBe(
        "Monitor",
      );
    });

    test("por stock disponible: primero lo que no queda", async () => {
      expect(
        (await nombres({ orden: "stock", dir: "asc" })).slice(0, 2).sort(),
      ).toEqual(["Auricular", "Mouse"]);
    });

    test("por fecha de carga, primero lo último", async () => {
      expect((await nombres({ orden: "fecha", dir: "desc" }))[0]).toBe(
        "Monitor",
      );
      expect((await nombres({ orden: "fecha", dir: "asc" }))[0]).toBe(
        "Auricular",
      );
    });

    test("destacados primero, y después por nombre", async () => {
      expect((await nombres({ orden: "destacados" }))[0]).toBe("Teclado");
    });
  });

  describe("lo que separa «vacío» de «sin resultados» (§8)", () => {
    /**
     * Ignora los filtros a propósito: con el conteo filtrado, una búsqueda
     * sin resultados diría que el catálogo está vacío.
     */
    test("el total cuenta todos los productos, sin mirar los filtros", async () => {
      const conteo = await contarPorEstado();
      expect(conteo.todos).toBeGreaterThanOrEqual(5);
    });

    test("activos e inactivos suman el total", async () => {
      const conteo = await contarPorEstado();
      expect(conteo.activos + conteo.inactivos).toBe(conteo.todos);
      expect(conteo.inactivos).toBeGreaterThanOrEqual(1);
    });

    /**
     * La condición está repetida en el conteo y en el `WHERE` del listado:
     * si se separan, la solapa dice 25 y la tabla trae 24.
     */
    test("cada solapa dice el número que su listado va a mostrar", async () => {
      const conteo = await contarPorEstado();
      const umbral = await umbralDeStockBajo();

      for (const estado of ["todos", "activos", "inactivos"] as const) {
        const { total } = await listarProductos(
          { ...FILTROS_VACIOS, estado },
          umbral,
        );
        expect(
          conteo[estado],
          `la solapa «${estado}» dice ${conteo[estado]} y el listado trae ${total}`,
        ).toBe(total);
      }
    });

    test("«todos» es el total de la tabla, sin filtros de por medio", async () => {
      const conteo = await contarPorEstado();
      const [fila] = await db.execute<{ total: number }>(
        sql`SELECT count(*)::int AS total FROM products`,
      );
      expect(Object.keys(conteo).sort()).toEqual([
        "activos",
        "inactivos",
        "todos",
      ]);
      expect(conteo.todos).toBe(fila.total);
    });

    test("el umbral sale de site_settings, y sin fila es 3", async () => {
      const [fila] = await db.execute<{ u: number }>(
        sql`SELECT low_stock_threshold AS u FROM site_settings WHERE id = 1`,
      );
      expect(await umbralDeStockBajo()).toBe(fila?.u ?? 3);
    });
  });

  describe("la paginación (§6.9)", () => {
    const pagina = async (n: number, porPagina = 2) => {
      const todos = await filas(
        con({ q: marca, orden: "nombre", dir: "asc" }),
        3,
      );
      return todos.slice((n - 1) * porPagina, n * porPagina).map((p) => p.name);
    };

    test("el total es el de los filtros, no el de la página", async () => {
      const { productos, total } = await listarProductos(
        con({ q: marca, orden: "nombre", dir: "asc" }),
        3,
      );
      // Lo que se fija es que `total` cuente las filas ya agrupadas: el filtro
      // de stock vive en HAVING.
      expect(total).toBe(5);
      expect(productos).toHaveLength(5);
    });

    test("el total respeta el filtro de stock, que se resuelve en HAVING", async () => {
      const { productos, total } = await listarProductos(
        con({ q: marca, stock: "sin" }),
        3,
      );
      expect(total).toBe(productos.length);
      expect(total).toBeLessThan(5);
    });

    test("el orden desempata, así que las páginas no se pisan", async () => {
      // Sin un criterio único, un producto puede caer en dos páginas o en ninguna.
      const primera = await pagina(1);
      const segunda = await pagina(2);
      const tercera = await pagina(3);
      expect([...primera, ...segunda, ...tercera]).toEqual(
        ["Auricular", "Cable", "Monitor", "Mouse", "Teclado"].map((n) =>
          expect.stringContaining(n),
        ),
      );
      expect(new Set([...primera, ...segunda, ...tercera]).size).toBe(5);
    });

    test("pedir una página que no existe devuelve vacío, no falla", async () => {
      const { productos, total } = await listarProductos(
        con({ q: marca, pagina: 99 }),
        3,
      );
      expect(productos).toHaveLength(0);
      // El total sigue siendo el de los filtros: la pantalla lo usa para
      // mandar a la última página que existe.
      expect(total).toBe(5);
    });
  });
});
