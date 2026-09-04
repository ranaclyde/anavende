/**
 * Comprueba que las restricciones de §5 RECHACEN lo que tienen que rechazar.
 *
 * Que un CHECK exista no prueba que haga algo. La spec dice que son «parte
 * del diseño, no un adorno» (F1.5): esto es lo que lo demuestra.
 * Todo corre dentro de una transacción que al final se revierte.
 */
import postgres from "postgres";

try { process.loadEnvFile(".env.local"); } catch {}

// Escribe en la base: no corre contra nada que no sea el stack local.
const { soloLocal } = await import("./solo-local.mts");
soloLocal("db:restricciones");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

type Tx = Parameters<Parameters<typeof sql.begin>[0]>[0];

/**
 * Cada intento va dentro de un SAVEPOINT: en Postgres una sentencia que viola
 * una restricción aborta la transacción entera, y sin punto de retorno la
 * primera prueba dejaría a todas las siguientes sin poder ejecutarse.
 */
async function rechaza(tx: Tx, nombre: string, fn: (t: Tx) => Promise<unknown>) {
  try {
    await tx.savepoint((sp) => fn(sp as Tx) as Promise<never>);
    fallos++;
    console.log(`❌ ${nombre} — se aceptó, y no debía`);
  } catch (e) {
    const err = e as { constraint_name?: string; message: string };
    console.log(`✅ ${nombre} — rechazado por ${err.constraint_name ?? err.message.slice(0, 60)}`);
  }
}

async function acepta(tx: Tx, nombre: string, fn: (t: Tx) => Promise<unknown>) {
  try {
    await tx.savepoint((sp) => fn(sp as Tx) as Promise<never>);
    console.log(`✅ ${nombre}`);
  } catch (e) {
    fallos++;
    console.log(`❌ ${nombre} — ${(e as Error).message.slice(0, 90)}`);
  }
}

/**
 * Un sufijo distinto en cada corrida.
 *
 * La transacción se revierte entera, así que el andamiaje no queda escrito —
 * pero los nombres y los slugs SÍ chocan con lo que ya haya en la base
 * mientras la transacción vive, y ahí el script muere con un 23505 que no
 * tiene nada que ver con lo que estaba probando. Pasó con una categoría
 * «Teclados» cargada a mano y con una marca «Logitech» cargada al probar
 * F2.4: el script no prueba el catálogo, así que sus datos no tienen por qué
 * pelearse con él.
 */
const n = Date.now();

await sql.begin(async (tx) => {
  // Andamiaje mínimo para poder insertar productos.
  const [marca] = await tx`INSERT INTO brands (name, slug)
    VALUES (${`Logitech ${n}`}, ${`logitech-${n}`}) RETURNING id`;
  const [cat] = await tx`INSERT INTO categories (name, slug)
    VALUES (${`Teclados ${n}`}, ${`teclados-${n}`}) RETURNING id`;

  console.log("── products (RN-04b, §7.2) ──");
  await rechaza(tx, "descuento igual al precio", (tx) =>
    tx`INSERT INTO products (name,slug,brand_id,category_id,price,discount)
       VALUES ('A',${`a-${n}`},${marca.id},${cat.id},1000.00,1000.00)`);
  await rechaza(tx, "descuento mayor al precio", (tx) =>
    tx`INSERT INTO products (name,slug,brand_id,category_id,price,discount)
       VALUES ('B',${`b-${n}`},${marca.id},${cat.id},1000.00,1500.00)`);
  await rechaza(tx, "precio cero", (tx) =>
    tx`INSERT INTO products (name,slug,brand_id,category_id,price)
       VALUES ('C',${`c-${n}`},${marca.id},${cat.id},0)`);

  const [prod] = await tx`INSERT INTO products (name,slug,brand_id,category_id,price,discount)
    VALUES ('Teclado Mecánico K120',${`k120-${n}`},${marca.id},${cat.id},27500.00,3000.00)
    RETURNING id, price, discount, final_price`;
  ok(
    prod.final_price === "24500.00",
    `final_price se calcula en la base: ${prod.price} − ${prod.discount} = ${prod.final_price}`,
  );

  console.log("\n── product_variants (§8.2) ──");
  const [v] = await tx`INSERT INTO product_variants (product_id, stock_total, reserved_stock)
    VALUES (${prod.id}, 5, 2) RETURNING id`;
  await rechaza(tx, "reserva mayor al total", (tx) =>
    tx`UPDATE product_variants SET reserved_stock = 9 WHERE id = ${v.id}`);
  await rechaza(tx, "reserva negativa", (tx) =>
    tx`UPDATE product_variants SET reserved_stock = -1 WHERE id = ${v.id}`);
  // RF-24 y §8.1: una orden manual creada YA FINALIZADA descuenta de
  // stock_total y «puede quedar negativo». Los dos casos que importan:
  await acepta(tx, "stock_total negativo, sin reservas (§5.4: señal de discrepancia)", (tx) =>
    tx`UPDATE product_variants SET reserved_stock = 0, stock_total = -2 WHERE id = ${v.id}`);
  await acepta(tx, "stock_total negativo, con reservas web vivas (§8.1)", (tx) =>
    tx`UPDATE product_variants SET stock_total = -2 WHERE id = ${v.id}`);
  await rechaza(tx, "una variante no puede tomar sus propias imágenes", (tx) =>
    tx`UPDATE product_variants SET images_source_id = ${v.id} WHERE id = ${v.id}`);
  await rechaza(tx, "dos variantes del mismo producto sin color", (tx) =>
    tx`INSERT INTO product_variants (product_id) VALUES (${prod.id})`);

  console.log("\n── user_profiles (RF-27) ──");
  const [u] = await tx`INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ana@test.local')
    RETURNING id`;
  await tx`INSERT INTO user_profiles (id, full_name, email, phone, role)
    VALUES (${u.id},'Ana','ana@test.local','+5491100000000','admin')`;
  await rechaza(tx, "bloquear SIN motivo", (tx) =>
    tx`UPDATE user_profiles SET is_banned = true WHERE id = ${u.id}`);
  await acepta(tx, "bloquear CON motivo", (tx) =>
    tx`UPDATE user_profiles SET is_banned = true, ban_reason = 'Prueba' WHERE id = ${u.id}`);
  await rechaza(tx, "un rol que no existe", (tx) =>
    tx`UPDATE user_profiles SET role = 'superadmin' WHERE id = ${u.id}`);
  await rechaza(tx, "borrar la identidad deja el perfil huérfano", async (tx) => {
    await tx`DELETE FROM auth.users WHERE id = ${u.id}`;
    const q = await tx`SELECT 1 FROM user_profiles WHERE id = ${u.id}`;
    if (q.length === 0) throw new Error("el perfil se borró en cascada, como corresponde");
  });

  console.log("\n── orders (§5.6) ──");
  await rechaza(tx, "orden web sin usuario", (tx) =>
    tx`INSERT INTO orders (origin, customer_name, customer_phone)
       VALUES ('web','Alguien','+5491100000000')`);
  await acepta(tx, "orden manual sin usuario (RF-24)", (tx) =>
    tx`INSERT INTO orders (origin, customer_name, customer_phone)
       VALUES ('manual','Cliente de mostrador','+5491100000000')`);

  console.log("\n── site_settings (§5.9) ──");
  await tx`INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
    VALUES (1,'+5491100000000','ana@test.local')`;
  await rechaza(tx, "una segunda fila de configuración", (tx) =>
    tx`INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
       VALUES (2,'+5491100000001','otra@test.local')`);

  throw new Error("__revertir__");
}).catch((e) => { if (!String(e.message).includes("__revertir__")) throw e; });

const quedaron = await sql`SELECT count(*)::int n FROM products`;
console.log(`\nLa transacción se revirtió: quedan ${quedaron[0].n} productos.`);
await sql.end();
console.log(fallos ? `${fallos} fallaron.` : "Todo en orden.");
process.exit(fallos ? 1 : 0);
