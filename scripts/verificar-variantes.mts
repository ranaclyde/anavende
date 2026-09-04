/**
 * Comprueba las reglas de F2.4 contra Postgres y contra Storage de verdad —
 * RF-16, RF-17, RN-11b, §5.4, §8.1, §9.2, §9.5.
 *
 * Lo que se prueba acá es lo que NO se ve leyendo el código:
 *
 *   · Que el orden de las imágenes se mantenga consistente después de
 *     borrar una del medio. Es el error que se arregló en F2.4: `sortOrder`
 *     es a la vez el orden de la galería y el número de la próxima subida, y
 *     borrar la primera de tres dejaba dos imágenes con el mismo número —o
 *     sea, la portada del producto cambiando sola.
 *   · Que borrar un producto se lleve los archivos de todas sus variantes.
 *   · Que las restricciones de la base sean las que se creen que son.
 *
 * Corre con `--conditions=react-server` (ver `package.json`), por lo mismo
 * que `db:imagenes`: los módulos que prueba llevan `server-only`.
 *
 * Deja la base y el bucket como los encontró.
 */
import postgres from "postgres";
import sharp from "sharp";

try { process.loadEnvFile(".env.local"); } catch {}

// Escribe en la base: no corre contra nada que no sea el stack local.
const { soloLocal } = await import("./solo-local.mts");
soloLocal("db:variantes");

const { crearVariante, ordenDeImagenes } = await import(
  "../modules/catalog/variants/schemas.ts"
);
const {
  publicarImagenDeVariante,
  borrarImagenDeVariante,
  reordenarImagenesDeVariante,
  clavesDeVariante,
  clavesDeProducto,
  borrarArchivos,
} = await import("../modules/media/subir.ts");
const { almacenamiento } = await import("../lib/storage/index.ts");
const { clave, TAMANOS } = await import("../modules/media/tamanos.ts");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const store = almacenamiento();
let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

async function rechaza(nombre: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(false, `${nombre} — se aceptó, y no debía`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    ok(true, `${nombre} — «${m.slice(0, 70)}…»`);
  }
}

const existe = async (key: string) => {
  const r = await fetch(store.publicUrl(key), { method: "HEAD" });
  return r.ok;
};

/** Un JPG chico y con ruido, para que pese algo de verdad. */
async function jpg(ancho = 400, alto = 300) {
  const pixeles = Buffer.allocUnsafe(ancho * alto * 3);
  for (let i = 0; i < pixeles.length; i++) pixeles[i] = Math.floor(Math.random() * 256);
  return sharp(pixeles, { raw: { width: ancho, height: alto, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

const marca = Date.now();

// ── 1. Validación (RF-16) ──────────────────────────────────────────────
console.log("── Validación (RF-16) ──");

const base = { productId: crypto.randomUUID(), colorId: null };

ok(
  crearVariante.safeParse({ ...base, stockTotal: 0 }).success,
  "Una variante sin color y con stock cero es válida (la variante «Único»)",
);
ok(
  !crearVariante.safeParse({ ...base, stockTotal: -3 }).success,
  "Un stock negativo escrito a mano se rechaza, aunque la columna lo admita",
);
ok(
  !crearVariante.safeParse({ ...base, stockTotal: 2.5 }).success,
  "Media unidad no existe",
);
ok(
  !crearVariante.safeParse({ ...base, stockTotal: "5" }).success,
  "El stock llega como número, no como texto",
);
ok(
  !ordenDeImagenes.safeParse({
    variantId: crypto.randomUUID(),
    ids: Array.from({ length: 6 }, () => crypto.randomUUID()),
  }).success,
  "Un orden de seis imágenes se rechaza: entran cinco (RF-17)",
);

// ── 2. Contra la base y contra Storage ─────────────────────────────────

const [b] = await sql`
  INSERT INTO brands (name, slug) VALUES ('Prueba Variantes', ${'prueba-var-' + marca})
  RETURNING id`;
const [c] = await sql`
  INSERT INTO categories (name, slug) VALUES ('Prueba Variantes', ${'prueba-var-cat-' + marca})
  RETURNING id`;
const [negro] = await sql`
  INSERT INTO colors (name, slug, hex_code) VALUES (${'Negro ' + marca}, ${'negro-' + marca}, '#111111')
  RETURNING id`;
const [blanco] = await sql`
  INSERT INTO colors (name, slug, hex_code) VALUES (${'Blanco ' + marca}, ${'blanco-' + marca}, '#eeeeee')
  RETURNING id`;
const [p] = await sql`
  INSERT INTO products (name, slug, brand_id, category_id, price)
  VALUES ('Producto de variantes', ${'producto-var-' + marca}, ${b.id}, ${c.id}, 1000)
  RETURNING id`;

const productos: string[] = [p.id];

try {
  console.log("\n── Restricciones de la base (§5.4) ──");

  const [vNegro] = await sql`
    INSERT INTO product_variants (product_id, color_id, stock_total)
    VALUES (${p.id}, ${negro.id}, 10) RETURNING id`;
  const [vBlanco] = await sql`
    INSERT INTO product_variants (product_id, color_id, stock_total)
    VALUES (${p.id}, ${blanco.id}, 4) RETURNING id`;

  await rechaza("Dos variantes del mismo color en un producto", () =>
    sql`INSERT INTO product_variants (product_id, color_id) VALUES (${p.id}, ${negro.id})`,
  );

  // La variante única entra por el COALESCE del índice: sin él, dos filas con
  // `color_id` NULL no chocarían —en SQL, NULL nunca es igual a NULL— y un
  // producto podría terminar con dos variantes «Único».
  await sql`INSERT INTO product_variants (product_id) VALUES (${p.id})`;
  await rechaza("Dos variantes SIN color en un producto", () =>
    sql`INSERT INTO product_variants (product_id) VALUES (${p.id})`,
  );
  await sql`DELETE FROM product_variants WHERE product_id = ${p.id} AND color_id IS NULL`;

  await rechaza("Una variante que se reutiliza a sí misma", () =>
    sql`UPDATE product_variants SET images_source_id = id WHERE id = ${vNegro.id}`,
  );

  // §5.4: el total negativo es la SEÑAL de discrepancia de RF-24, no un error.
  await sql`UPDATE product_variants SET stock_total = -2 WHERE id = ${vBlanco.id}`;
  const [neg] = await sql`SELECT stock_total FROM product_variants WHERE id = ${vBlanco.id}`;
  ok(neg.stock_total === -2, "Un stock total negativo se acepta (RF-24, §5.4)");
  await sql`UPDATE product_variants SET stock_total = 4 WHERE id = ${vBlanco.id}`;

  await sql`UPDATE product_variants SET reserved_stock = 3 WHERE id = ${vNegro.id}`;
  await rechaza("Bajar el total por debajo de lo reservado", () =>
    sql`UPDATE product_variants SET stock_total = 1 WHERE id = ${vNegro.id}`,
  );
  await sql`UPDATE product_variants SET reserved_stock = 0 WHERE id = ${vNegro.id}`;

  // ── 3. Reutilizar imágenes: el salto único de §9.5 ───────────────────
  console.log("\n── Reutilizar imágenes (§9.5) ──");

  await sql`UPDATE product_variants SET images_source_id = ${vNegro.id} WHERE id = ${vBlanco.id}`;

  await rechaza("Subirle una imagen propia a una variante que reutiliza las de otra", () =>
    publicarImagenDeVariante({
      productId: p.id,
      variantId: vBlanco.id,
      archivo: Buffer.from([]),
    }),
  );

  // ── 4. Orden de las imágenes (RF-17) ─────────────────────────────────
  console.log("\n── Orden y principal (RF-17) ──");

  const foto = await jpg();
  const subidas = [];
  for (let i = 0; i < 3; i++) {
    subidas.push(
      await publicarImagenDeVariante({
        productId: p.id,
        variantId: vNegro.id,
        archivo: foto,
      }),
    );
  }

  const posiciones = async () =>
    (
      await sql`SELECT id, sort_order FROM variant_images
                 WHERE variant_id = ${vNegro.id} ORDER BY sort_order`
    ).map((f) => ({ id: f.id as string, n: f.sort_order as number }));

  ok(
    (await posiciones()).map((x) => x.n).join(",") === "0,1,2",
    "Tres subidas quedan en 0, 1 y 2",
  );

  await rechaza("Subir a una variante de OTRO producto con el id equivocado", () =>
    publicarImagenDeVariante({
      productId: crypto.randomUUID(),
      variantId: vNegro.id,
      archivo: foto,
    }),
  );

  // Elegir la principal es mover al frente: la tercera pasa a ser la 0.
  const orden = (await posiciones()).map((x) => x.id);
  await reordenarImagenesDeVariante(vNegro.id, [orden[2], orden[0], orden[1]]);
  const reordenadas = await posiciones();
  ok(
    reordenadas[0].id === orden[2],
    "«Hacer principal» deja la elegida en la posición 0",
  );
  ok(
    reordenadas.map((x) => x.n).join(",") === "0,1,2",
    "Y las posiciones siguen siendo 0, 1 y 2",
  );

  await rechaza("Un orden al que le falta una imagen", () =>
    reordenarImagenesDeVariante(vNegro.id, [orden[0]]),
  );
  await rechaza("Un orden con una imagen repetida", () =>
    reordenarImagenesDeVariante(vNegro.id, [orden[0], orden[0], orden[1]]),
  );

  // ── 5. Borrar del medio no puede dejar dos con el mismo número ───────
  //
  // Este es el error que F2.4 arregló. Sin la renumeración: se borra la
  // primera de tres, quedan [1, 2], y la próxima subida —que se numera con la
  // CANTIDAD, que es 2— vuelve a ser 2. Dos imágenes en la misma posición y un
  // orden que pasa a depender de cuál devuelva antes Postgres.
  const antes = await posiciones();
  const clavesBorrada = TAMANOS.map(({ sufijo }) =>
    clave(subidas.find((s) => s.id === antes[0].id)!.storageKey, sufijo),
  );

  await borrarImagenDeVariante(antes[0].id);
  ok(
    (await posiciones()).map((x) => x.n).join(",") === "0,1",
    "Borrar la principal renumera las que quedan a 0 y 1",
  );
  ok(
    (await Promise.all(clavesBorrada.map(existe))).every((e) => !e),
    "Y se lleva sus tres archivos de Storage",
  );

  const cuarta = await publicarImagenDeVariante({
    productId: p.id,
    variantId: vNegro.id,
    archivo: foto,
  });
  const conLaCuarta = await posiciones();
  ok(
    conLaCuarta.map((x) => x.n).join(",") === "0,1,2",
    "Y la siguiente subida entra en la 2, sin repetir número",
  );
  ok(
    conLaCuarta.at(-1)!.id === cuarta.id,
    "La nueva va al final, no al frente: reordenar es otra acción",
  );

  // ── 6. Las claves que hay que borrar al borrar (RF-15, RF-17) ────────
  console.log("\n── Borrar se lleva los archivos ──");

  const deLaVariante = await clavesDeVariante(vNegro.id);
  ok(
    deLaVariante.length === 3 * TAMANOS.length,
    `\`clavesDeVariante\` devuelve las ${deLaVariante.length} claves de sus 3 imágenes`,
  );

  const delProducto = await clavesDeProducto(p.id);
  ok(
    delProducto.length === deLaVariante.length,
    "`clavesDeProducto` junta las de todas sus variantes",
  );
  ok(
    (await Promise.all(delProducto.map(existe))).every(Boolean),
    "Y todas están en Storage antes de borrar",
  );

  // El camino completo de `eliminarUnProducto`: leer, borrar la fila, borrar
  // los archivos. Sin la primera lectura, el DELETE en cascada se lleva
  // `variant_images` y con ella la única referencia a los archivos.
  await sql`DELETE FROM products WHERE id = ${p.id}`;
  productos.length = 0;
  await borrarArchivos(delProducto);

  ok(
    (await Promise.all(delProducto.map(existe))).every((e) => !e),
    "Borrar el producto deja Storage sin ninguno de sus archivos",
  );

  const [huerfanas] = await sql`SELECT count(*)::int AS n FROM variant_images
    WHERE variant_id = ${vNegro.id}`;
  ok(huerfanas.n === 0, "Y la cascada se llevó las filas de `variant_images`");

  // ── 7. RN-11b: qué cuenta como «color en uso por algo activo» ────────
  console.log("\n── RN-11b sobre colores ──");

  const [p2] = await sql`
    INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
    VALUES ('Producto RN11b', ${'producto-rn11b-' + marca}, ${b.id}, ${c.id}, 1000, true)
    RETURNING id`;
  productos.push(p2.id);

  const uso = async (colorId: string) => {
    const [f] = await sql`
      SELECT count(*) FILTER (WHERE is_active)::int AS activos,
             count(*)::int AS total
        FROM (SELECT bool_or(v.is_active AND p.is_active) AS is_active
                FROM product_variants v
                JOIN products p ON p.id = v.product_id
               WHERE v.color_id = ${colorId}
               GROUP BY p.id) AS usos`;
    return f as { activos: number; total: number };
  };

  const [vActiva] = await sql`
    INSERT INTO product_variants (product_id, color_id, is_active)
    VALUES (${p2.id}, ${negro.id}, true) RETURNING id`;

  const conActiva = await uso(negro.id);
  ok(
    conActiva.activos === 1 && conActiva.total === 1,
    "Una variante activa de un producto activo bloquea desactivar el color",
  );

  await sql`UPDATE product_variants SET is_active = false WHERE id = ${vActiva.id}`;
  const conInactiva = await uso(negro.id);
  ok(
    conInactiva.activos === 0 && conInactiva.total === 1,
    "Con la variante desactivada ya no bloquea, pero sigue contando como uso (RN-11)",
  );
} finally {
  // ── Limpieza ─────────────────────────────────────────────────────────
  const restantes = await sql`
    SELECT i.id FROM variant_images i
      JOIN product_variants v ON v.id = i.variant_id
     WHERE v.product_id = ANY(${productos})`;
  for (const r of restantes) await borrarImagenDeVariante(r.id).catch(() => {});

  if (productos.length) await sql`DELETE FROM products WHERE id = ANY(${productos})`;
  await sql`DELETE FROM colors WHERE id IN (${negro.id}, ${blanco.id})`;
  await sql`DELETE FROM brands WHERE id = ${b.id}`;
  await sql`DELETE FROM categories WHERE id = ${c.id}`;
}

console.log(
  fallos ? `\n${fallos} fallo(s)` : "\nTodo en orden. Nada quedó en la base ni en Storage.",
);
await sql.end();
process.exit(fallos ? 1 : 0);
