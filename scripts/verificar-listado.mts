/**
 * Comprueba las reglas de F2.5 contra Postgres — RF-15, RF-20, §10.2.
 *
 * Lo que se prueba acá es lo que NO se ve leyendo el código:
 *
 *   · Que los tres números de stock salgan bien de la SUMA de las variantes,
 *     incluido el caso que no se nota: un color en −3 y otro en +10 suman 7,
 *     así que la discrepancia de RF-24 hay que contarla por variante o
 *     desaparece.
 *   · Que el filtro de stock viva en HAVING y no en WHERE. En WHERE se
 *     evalúa variante por variante, y un producto con un color en cero y
 *     otro con diez aparecería como «sin stock».
 *   · Que la búsqueda encuentre por nombre, por marca y por descripción, sin
 *     acentos, y que `%` y `_` sean lo que dicen y no comodines.
 *   · Que la URL sobreviva a que alguien la edite a mano.
 *
 * Corre con `--conditions=react-server` (ver `package.json`): los módulos
 * que prueba llevan `server-only`.
 *
 * Deja la base como la encontró.
 */
import postgres from "postgres";

try { process.loadEnvFile(".env.local"); } catch {}

// Escribe en la base: no corre contra nada que no sea el stack local.
const { soloLocal } = await import("./solo-local.mts");
soloLocal("db:listado");

const {
  DIRECCION_NATURAL,
  FILTROS_VACIOS,
  hayFiltros,
  leerFiltros,
  sinFiltros,
  urlDeFiltros,
  urlDeOrden,
} = await import("../modules/catalog/products/filtros.ts");
const { contarProductos, listarProductos } = await import(
  "../modules/catalog/products/queries.ts"
);
const { umbralDeStockBajo } = await import("../modules/settings/queries.ts");

type Filtros = Parameters<typeof listarProductos>[0];

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

const marca = Date.now();
const con = (cambios: Partial<Filtros>): Filtros => ({
  ...FILTROS_VACIOS,
  ...cambios,
});

// ── 1. Leer la URL sin fallar nunca (§10.2) ────────────────────────────
console.log("── La URL (§10.2) ──");

ok(
  leerFiltros({}).orden === "destacados" &&
    leerFiltros({}).dir === DIRECCION_NATURAL.destacados,
  "Sin parámetros quedan los valores de siempre",
);
ok(
  leerFiltros({ orden: "carisimo", estado: "borrados" }).orden === "destacados" &&
    leerFiltros({ estado: "borrados" }).estado === "todos",
  "Un valor que no existe se descarta en vez de romper la pantalla",
);
ok(
  leerFiltros({ marca: "hola" }).marca === "" &&
    leerFiltros({ categoria: "1; DROP TABLE" }).categoria === "",
  "Lo que no tiene forma de UUID no llega a la consulta",
);
ok(
  leerFiltros({ q: ["uno", "dos"] }).q === "uno",
  "Un parámetro repetido toma el primero, no falla",
);
ok(
  leerFiltros({ orden: "fecha" }).dir === "desc" &&
    leerFiltros({ orden: "nombre" }).dir === "asc",
  "Cada orden arranca por su dirección natural: la fecha por lo último",
);
ok(
  leerFiltros({ orden: "fecha", dir: "asc" }).dir === "asc",
  "…y la dirección de la URL manda sobre la natural",
);

ok(
  urlDeFiltros(FILTROS_VACIOS) === "/admin/productos",
  "Un listado sin tocar es /admin/productos a secas",
);
ok(
  urlDeFiltros(con({ orden: "fecha", dir: "desc" })) ===
    "/admin/productos?orden=fecha",
  "La dirección natural no se escribe: la URL dice solo lo que se cambió",
);
ok(
  urlDeOrden(con({ orden: "precio", dir: "asc" }), "precio") ===
    "/admin/productos?orden=precio&dir=desc",
  "Volver a ordenar por la misma columna da vuelta la dirección",
);
ok(
  urlDeOrden(con({ orden: "fecha", dir: "asc" }), "precio") ===
    "/admin/productos?orden=precio",
  "Cambiar de columna arranca por su dirección natural, no hereda la anterior",
);
ok(
  !hayFiltros(con({ orden: "precio" })) && hayFiltros(con({ q: "algo" })),
  "El orden no es un filtro: «Limpiar todo» aparece por búsqueda o filtros",
);
ok(
  sinFiltros(con({ q: "algo", orden: "precio", dir: "desc" })).orden === "precio",
  "Limpiar los filtros conserva el orden elegido",
);

// ── 2. Contra la base ──────────────────────────────────────────────────
const productos: string[] = [];
const [marcaA] = await sql`
  INSERT INTO brands (name, slug) VALUES (${`Lojitech ${marca}`}, ${`lojitech-${marca}`})
  RETURNING id`;
const [marcaB] = await sql`
  INSERT INTO brands (name, slug) VALUES (${`Otramarca ${marca}`}, ${`otramarca-${marca}`})
  RETURNING id`;
const [catA] = await sql`
  INSERT INTO categories (name, slug) VALUES (${`Teclados ${marca}`}, ${`teclados-${marca}`})
  RETURNING id`;
const [catB] = await sql`
  INSERT INTO categories (name, slug) VALUES (${`Cables ${marca}`}, ${`cables-${marca}`})
  RETURNING id`;
const [negro] = await sql`
  INSERT INTO colors (name, slug, hex_code) VALUES (${`Negro ${marca}`}, ${`negro-${marca}`}, '#000000')
  RETURNING id`;
const [blanco] = await sql`
  INSERT INTO colors (name, slug, hex_code) VALUES (${`Blanco ${marca}`}, ${`blanco-${marca}`}, '#FFFFFF')
  RETURNING id`;

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
  const [p] = await sql`
    INSERT INTO products (name, slug, description, brand_id, category_id, price,
                          is_featured, is_active, created_at)
    VALUES (${nombre}, ${`${nombre}-${marca}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")},
            ${o.descripcion ?? ""}, ${o.brand}, ${o.cat}, ${o.price},
            ${o.destacado ?? false}, ${o.activo ?? true},
            now() - make_interval(days => ${o.dias ?? 0}))
    RETURNING id`;
  productos.push(p.id);
  return p.id as string;
}

const variante = (
  productId: string,
  colorId: string,
  total: number,
  reservado = 0,
) => sql`
  INSERT INTO product_variants (product_id, color_id, stock_total, reserved_stock)
  VALUES (${productId}, ${colorId}, ${total}, ${reservado})`;

try {
  // Un teclado destacado con stock de sobra.
  const teclado = await producto(`Teclado Mecánico ${marca}`, {
    brand: marcaA.id, cat: catA.id, price: "10000.00", destacado: true, dias: 3,
  });
  await variante(teclado, negro.id, 10, 2);

  // Un cable barato cuya descripción es la única que nombra «USB-C».
  const cable = await producto(`Cable ${marca}`, {
    brand: marcaA.id, cat: catB.id, price: "500.00", dias: 2,
    descripcion: "Compatible con **USB-C** y 50% más rápido.",
  });
  await variante(cable, negro.id, 2);

  // Un mouse inactivo y sin nada disponible.
  const mouse = await producto(`Mouse ${marca}`, {
    brand: marcaB.id, cat: catA.id, price: "3000.00", activo: false, dias: 1,
  });
  await variante(mouse, negro.id, 0);

  // Un monitor con un color en negativo y otro con stock: la discrepancia
  // que la suma esconde (RF-24, §5.4).
  const monitor = await producto(`Monitor ${marca}`, {
    brand: marcaB.id, cat: catB.id, price: "80000.00", dias: 0,
  });
  await variante(monitor, negro.id, -3);
  await variante(monitor, blanco.id, 10);

  // Un producto recién cargado, todavía sin colores (F2.4: el alta va en dos
  // pasos, así que este estado existe de verdad).
  const auricular = await producto(`Auricular ${marca}`, {
    brand: marcaA.id, cat: catA.id, price: "7000.00", dias: 4,
  });

  const soloNuestros = { marca: "", categoria: "" };
  const ids = async (f: Partial<Filtros>) =>
    (await listarProductos(con({ q: String(marca), ...soloNuestros, ...f }), 3))
      .map((p) => p.id);

  console.log("\n── El stock, que sale de la suma de las variantes ──");

  const todos = await listarProductos(con({ q: String(marca) }), 3);
  const porId = new Map(todos.map((p) => [p.id, p]));

  const t = porId.get(teclado)!;
  ok(
    t.stockTotal === 10 && t.reservado === 2 && t.disponible === 8,
    "Total, reservado y disponible por producto (RF-15): 10, 2 y 8",
  );

  const m = porId.get(monitor)!;
  ok(
    m.stockTotal === 7 && m.disponible === 7,
    "Un color en −3 y otro en +10 suman 7: el total no muestra la discrepancia",
  );
  ok(
    m.variantesEnNegativo === 1,
    "…y por eso se cuenta aparte: el producto queda marcado igual",
  );
  ok(
    porId.get(auricular)!.variantes === 0 &&
      porId.get(auricular)!.disponible === 0,
    "Un producto sin colores no tiene stock, y se distingue de tenerlo en cero",
  );

  console.log("\n── La búsqueda (§10.1, la mitad por subcadena) ──");

  const enMarcaA = { marca: marcaA.id };
  ok(
    (await listarProductos(con({ q: "teclado cable", ...enMarcaA }), 3)).length === 0,
    "El término se busca entero: «teclado cable» no es «teclado» o «cable»",
  );
  ok(
    (await listarProductos(con({ q: "mecanico", marca: marcaA.id }), 3))
      .map((p) => p.id)
      .includes(teclado),
    "«mecanico» encuentra «Mecánico»: la búsqueda no depende de los acentos",
  );
  ok(
    (await listarProductos(con({ q: `lojitech ${marca}` }), 3)).length === 3,
    "Buscar por el nombre de la marca trae sus tres productos",
  );
  ok(
    (await listarProductos(con({ q: "usb-c", marca: marcaA.id }), 3))
      .map((p) => p.id)
      .join() === cable,
    "La descripción también se busca, y el guion de «USB-C» sobrevive",
  );
  ok(
    (await listarProductos(con({ q: "%", marca: marcaA.id }), 3))
      .map((p) => p.id)
      .join() === cable,
    "Buscar «%» busca un por ciento —lo trae solo el que dice «50%»— y no todo",
  );
  ok(
    (await listarProductos(con({ q: "cabl_", marca: marcaA.id }), 3)).length === 0,
    "El guion bajo tampoco es un comodín",
  );

  console.log("\n── Los filtros (RF-15) ──");

  ok(
    (await ids({ categoria: catB.id })).sort().join() ===
      [cable, monitor].sort().join(),
    "Filtrar por categoría",
  );
  ok(
    (await ids({ marca: marcaB.id })).sort().join() ===
      [mouse, monitor].sort().join(),
    "Filtrar por marca",
  );
  ok(
    (await ids({ estado: "inactivos" })).join() === mouse,
    "Filtrar por estado: el único inactivo",
  );
  ok(
    (await ids({ estado: "activos" })).length === 4,
    "…y los otros cuatro siguen siendo los activos",
  );

  console.log("\n── El stock como filtro (RF-20) ──");

  const sinStock = await ids({ stock: "sin" });
  ok(
    sinStock.sort().join() === [mouse, auricular].sort().join(),
    "«Sin stock» son el que tiene cero y el que no tiene colores",
  );
  ok(
    !sinStock.includes(monitor),
    "El monitor NO es «sin stock» aunque tenga un color en cero o menos: " +
      "la suma se mira una vez por producto, no por variante (HAVING)",
  );
  ok(
    (await ids({ stock: "reponer" })).sort().join() ===
      [mouse, auricular, cable].sort().join(),
    "«Para reponer» agrega lo que está en el umbral o por debajo (2 ≤ 3)",
  );
  ok(
    (
      await listarProductos(
        con({ q: String(marca), stock: "reponer" }),
        1,
      )
    ).length === 2,
    "Con el umbral en 1, el cable de 2 unidades ya no hace falta reponerlo",
  );

  console.log("\n── El orden (RF-15) ──");

  const nombres = async (f: Partial<Filtros>) =>
    (await listarProductos(con({ q: String(marca), ...f }), 3)).map((p) =>
      p.name.split(" ")[0],
    );

  ok(
    (await nombres({ orden: "nombre", dir: "asc" })).join() ===
      "Auricular,Cable,Monitor,Mouse,Teclado",
    "Por nombre, de la A a la Z",
  );
  ok(
    (await nombres({ orden: "nombre", dir: "desc" })).join() ===
      "Teclado,Mouse,Monitor,Cable,Auricular",
    "…y al revés",
  );
  ok(
    (await nombres({ orden: "precio", dir: "asc" }))[0] === "Cable" &&
      (await nombres({ orden: "precio", dir: "desc" }))[0] === "Monitor",
    "Por precio, en los dos sentidos",
  );
  ok(
    (await nombres({ orden: "stock", dir: "asc" })).slice(0, 2).sort().join() ===
      "Auricular,Mouse",
    "Por stock disponible: primero lo que no queda",
  );
  ok(
    (await nombres({ orden: "fecha", dir: "desc" }))[0] === "Monitor" &&
      (await nombres({ orden: "fecha", dir: "asc" }))[0] === "Auricular",
    "Por fecha de carga, primero lo último",
  );
  ok(
    (await nombres({ orden: "destacados" }))[0] === "Teclado",
    "Destacados primero, y después por nombre",
  );

  console.log("\n── Lo que separa «vacío» de «sin resultados» (§8) ──");

  ok(
    (await contarProductos()) >= 5,
    "El total cuenta todos los productos, sin mirar los filtros",
  );

  const [fila] = await sql`SELECT low_stock_threshold AS u FROM site_settings WHERE id = 1`;
  ok(
    (await umbralDeStockBajo()) === (fila?.u ?? 3),
    fila
      ? `El umbral sale de site_settings (${fila.u})`
      : "Sin la fila de configuración —la escribe la vendedora en F2.7— el umbral es 3",
  );
} finally {
  if (productos.length) {
    await sql`DELETE FROM products WHERE id = ANY(${productos})`;
  }
  await sql`DELETE FROM colors WHERE id IN (${negro.id}, ${blanco.id})`;
  await sql`DELETE FROM brands WHERE id IN (${marcaA.id}, ${marcaB.id})`;
  await sql`DELETE FROM categories WHERE id IN (${catA.id}, ${catB.id})`;
}

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo en orden. Nada quedó en la base.");
await sql.end();
process.exit(fallos ? 1 : 0);
