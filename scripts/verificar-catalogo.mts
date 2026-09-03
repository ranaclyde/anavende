/**
 * Comprueba las reglas de RF-18 contra Postgres: los conteos del listado y la
 * invariante RN-11b.
 *
 * No prueba las Server Actions —eso necesita sesión— sino las CONSULTAS que
 * las sostienen. Si el conteo de uso está mal, la regla que decide si se
 * puede desactivar está mal, y eso no se ve leyendo el código.
 *
 * Todo corre en una transacción que al final se revierte.
 */
import postgres from "postgres";

try { process.loadEnvFile(".env.local"); } catch {}

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

type Tx = Parameters<Parameters<typeof sql.begin>[0]>[0];

/**
 * Cada intento que debe fallar va dentro de un SAVEPOINT, y el error se
 * atrapa AFUERA: si se atrapa adentro, `postgres` da por buena la operación
 * y libera el punto de retorno sobre una transacción ya abortada.
 */
async function rechaza(tx: Tx, nombre: string, fn: (t: Tx) => Promise<unknown>) {
  try {
    await tx.savepoint((sp) => fn(sp as Tx) as Promise<never>);
    ok(false, `${nombre} — se aceptó, y no debía`);
  } catch {
    ok(true, nombre);
  }
}

async function usoDeMarca(tx: Tx, id: string) {
  const [f] = await tx`
    SELECT count(*) FILTER (WHERE is_active)::int AS activos,
           count(*)::int AS total
      FROM (SELECT is_active FROM products WHERE brand_id = ${id}) AS usos`;
  return f as { activos: number; total: number };
}

async function usoDeColor(tx: Tx, id: string) {
  const [f] = await tx`
    SELECT count(*) FILTER (WHERE is_active)::int AS activos,
           count(*)::int AS total
      FROM (SELECT DISTINCT p.id, p.is_active
              FROM product_variants v
              JOIN products p ON p.id = v.product_id
             WHERE v.color_id = ${id}) AS usos`;
  return f as { activos: number; total: number };
}

await sql.begin(async (tx) => {
  const [marca] = await tx`
    INSERT INTO brands (name, slug) VALUES ('Probando Marca', 'probando-marca')
    RETURNING id`;
  const [cat] = await tx`
    INSERT INTO categories (name, slug) VALUES ('Probando Cat', 'probando-cat')
    RETURNING id`;
  const [color] = await tx`
    INSERT INTO colors (name, slug, hex_code)
    VALUES ('Probando Color', 'probando-color', '#112233') RETURNING id`;

  // ── Sin productos ────────────────────────────────────────────────────
  ok((await usoDeMarca(tx, marca.id)).total === 0, "Marca recién creada: 0 usos");
  ok((await usoDeColor(tx, color.id)).total === 0, "Color recién creado: 0 usos");

  // ── Un producto ACTIVO ───────────────────────────────────────────────
  const [prod] = await tx`
    INSERT INTO products (name, slug, brand_id, category_id, price)
    VALUES ('Producto de prueba', 'producto-de-prueba', ${marca.id}, ${cat.id}, 1000)
    RETURNING id`;

  let uso = await usoDeMarca(tx, marca.id);
  ok(uso.activos === 1 && uso.total === 1, "Con 1 producto activo: activos=1, total=1");

  // La restricción de la base tiene que impedir borrarla igual, aunque la
  // aplicación ya lo haya rechazado antes.
  await rechaza(tx, "ON DELETE RESTRICT impide borrar una marca en uso", (sp) =>
    sp`DELETE FROM brands WHERE id = ${marca.id}`);

  // ── El producto pasa a inactivo ──────────────────────────────────────
  await tx`UPDATE products SET is_active = false WHERE id = ${prod.id}`;
  uso = await usoDeMarca(tx, marca.id);
  ok(
    uso.activos === 0 && uso.total === 1,
    "Producto desactivado: activos=0, total=1 (se puede desactivar la marca, no borrarla)",
  );

  // ── Colores: el uso viaja por las variantes ──────────────────────────
  await tx`
    INSERT INTO product_variants (product_id, color_id) VALUES (${prod.id}, ${color.id})`;
  uso = await usoDeColor(tx, color.id);
  ok(uso.activos === 0 && uso.total === 1, "Color de un producto inactivo: activos=0, total=1");

  await tx`UPDATE products SET is_active = true WHERE id = ${prod.id}`;
  uso = await usoDeColor(tx, color.id);
  ok(uso.activos === 1, "Color de un producto activo: activos=1");

  // ── Unicidad sin distinción de mayúsculas ni acentos de más ──────────
  await rechaza(tx, "El nombre es único sin distinguir mayúsculas", (sp) =>
    sp`INSERT INTO brands (name, slug) VALUES ('PROBANDO MARCA', 'otro-slug')`);

  // ── Destacadas (RF-18) ───────────────────────────────────────────────
  const [recien] = await tx`
    SELECT is_featured FROM categories WHERE id = ${cat.id}`;
  ok(recien.is_featured === false, "Una categoría nueva NO nace destacada");

  // Destacar no publica: se puede destacar una categoría inactiva, y sigue
  // sin verse. `is_active` es la única verdad sobre la visibilidad.
  await tx`
    UPDATE categories SET is_featured = true, is_active = false
     WHERE id = ${cat.id}`;
  const [destacadaInactiva] = await tx`
    SELECT is_featured, is_active FROM categories WHERE id = ${cat.id}`;
  ok(
    destacadaInactiva.is_featured === true &&
      destacadaInactiva.is_active === false,
    "Destacada e inactiva conviven: destacar no publica",
  );

  // El orden que ve el comprador (§10.2): destacadas primero, después por
  // nombre. Se prueba con tres categorías cuyo orden alfabético contradice
  // al de destacadas, así el resultado no puede salir bien por casualidad.
  await tx`UPDATE categories SET is_active = true WHERE id = ${cat.id}`;
  await tx`
    INSERT INTO categories (name, slug, is_featured) VALUES
      ('Zzz Ultima', 'zzz-ultima', true),
      ('Aaa Primera', 'aaa-primera', false)`;
  const orden = await tx`
    SELECT name FROM categories
     WHERE is_active AND slug IN ('probando-cat', 'zzz-ultima', 'aaa-primera')
     ORDER BY is_featured DESC, immutable_unaccent(lower(name))`;
  ok(
    orden.map((f) => f.name).join(" | ") ===
      "Probando Cat | Zzz Ultima | Aaa Primera",
    "Orden público: destacadas primero, y entre ellas por nombre",
  );

  // ── El listado: conteos en una sola consulta ─────────────────────────
  const listado = await tx`
    SELECT b.id, b.name,
           count(p.id) FILTER (WHERE p.is_active)::int     AS activos,
           count(p.id) FILTER (WHERE NOT p.is_active)::int AS inactivos
      FROM brands b
      LEFT JOIN products p ON p.brand_id = b.id
     GROUP BY b.id
     ORDER BY immutable_unaccent(lower(b.name))`;
  const fila = listado.find((f) => f.id === marca.id);
  ok(fila?.activos === 1 && fila?.inactivos === 0, "El listado trae los conteos separados");
  ok(
    listado.length >= 1 && listado.every((f) => typeof f.activos === "number"),
    "Los conteos llegan como números, no como texto",
  );

  throw new Error("revertir");
}).catch((e) => {
  if (e.message !== "revertir") throw e;
});

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo en orden. Nada quedó escrito.");
await sql.end();
process.exit(fallos ? 1 : 0);
