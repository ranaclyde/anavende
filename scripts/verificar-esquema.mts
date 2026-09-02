/**
 * Comprueba que la base tenga lo que TECHNICAL-SPEC §5 declara.
 *
 * Es la condición de terminado de F1.6 —«base creada desde cero con una sola
 * corrida; pg_trgm, unaccent e immutable_unaccent presentes»— escrita como
 * algo que se puede volver a correr, en vez de una revisión a ojo que hay que
 * repetir a mano. Sirve igual contra el servidor DATA cuando F0.3 esté hecha:
 *   DATABASE_URL=... npm run db:verificar
 */
import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {
  // En CI y en el servidor las variables ya vienen del entorno.
}

const TABLAS_ESPERADAS = [
  "addresses", "brands", "cart_items", "carts", "categories",
  "category_relations", "colors", "favorites", "legal_pages", "order_items",
  "order_status_history", "orders", "payment_methods", "product_variants",
  "products", "return_items", "returns", "site_settings", "stock_movements",
  "user_profiles", "variant_images",
];

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let fallos = 0;
const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

// ── Tablas y enums ────────────────────────────────────────────────────
const tablas = (
  await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
    ORDER BY 1`
).map((t) => t.tablename);

const faltan = TABLAS_ESPERADAS.filter((t) => !tablas.includes(t));
ok(faltan.length === 0, `Tablas de §5: ${tablas.length} presentes${faltan.length ? ` — FALTAN: ${faltan.join(", ")}` : ""}`);

const enums = await sql<{ typname: string; n: number }[]>`
  SELECT t.typname, count(e.enumlabel)::int AS n
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typnamespace = 'public'::regnamespace
  GROUP BY 1 ORDER BY 1`;
ok(enums.length === 4, `Enums de §5.2: ${enums.map((e) => `${e.typname}(${e.n})`).join(", ")}`);

// ── Extensiones y búsqueda tolerante (§5.10) ─────────────────────────
const ext = (
  await sql<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent')`
).map((e) => e.extname);
ok(ext.length === 2, `Extensiones: ${ext.join(", ") || "ninguna"}`);

const fn = await sql<{ provolatile: string }[]>`
  SELECT provolatile FROM pg_proc WHERE proname = 'immutable_unaccent'`;
ok(
  fn[0]?.provolatile === "i",
  `immutable_unaccent presente e IMMUTABLE (hace falta para el índice de expresión)`,
);

// La prueba que pide F0.6: similitud real sobre texto con acentos.
const [sim] = await sql<{ con_acento: number; sin_acento: number; typo: number }[]>`
  SELECT
    similarity(immutable_unaccent(lower('Teclado Mecánico')), immutable_unaccent(lower('mecanico')))::float AS con_acento,
    similarity(immutable_unaccent(lower('Teclado Mecanico')), immutable_unaccent(lower('mecanico')))::float AS sin_acento,
    similarity(immutable_unaccent(lower('Logitech')), immutable_unaccent(lower('lojitech')))::float AS typo`;
ok(
  sim.con_acento === sim.sin_acento && sim.con_acento > 0.4,
  `«mecanico» encuentra «Mecánico» — con acento ${sim.con_acento.toFixed(3)}, sin acento ${sim.sin_acento.toFixed(3)} (iguales: el acento no cambia el resultado)`,
);
ok(sim.typo > 0.4, `«lojitech» se parece a «Logitech» — similitud ${sim.typo.toFixed(3)}`);

// ── Restricciones, columnas generadas e índices ──────────────────────
const checks = (
  await sql<{ conname: string }[]>`
    SELECT conname FROM pg_constraint
    WHERE contype = 'c' AND connamespace = 'public'::regnamespace ORDER BY 1`
).map((c) => c.conname);
for (const c of ["ban_has_reason", "discount_valid", "reserved_within_total", "web_order_has_user", "singleton"]) {
  ok(checks.includes(c), `CHECK ${c}`);
}

const gen = await sql<{ table_name: string; column_name: string }[]>`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE is_generated = 'ALWAYS' AND table_schema = 'public' ORDER BY 1`;
ok(gen.length === 2, `Columnas generadas: ${gen.map((g) => `${g.table_name}.${g.column_name}`).join(", ")}`);

const [authFk] = await sql<{ destino: string }[]>`
  SELECT confrelid::regclass::text AS destino FROM pg_constraint
  WHERE conname = 'user_profiles_id_auth_users_fk'`;
ok(authFk?.destino === "auth.users", `user_profiles.id referencia ${authFk?.destino ?? "nada"}`);

const gin = await sql<{ indexname: string }[]>`
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public' AND indexdef LIKE '%gin%' ORDER BY 1`;
ok(gin.length === 3, `Índices GIN de búsqueda: ${gin.length}`);

const parciales = await sql<{ indexname: string }[]>`
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public' AND indexdef LIKE '%WHERE%' ORDER BY 1`;
ok(parciales.length === 5, `Índices parciales: ${parciales.map((i) => i.indexname).join(", ")}`);

await sql.end();
console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : "\nTodo en orden.");
process.exit(fallos ? 1 : 0);
