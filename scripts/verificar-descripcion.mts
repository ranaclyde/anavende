/**
 * Comprueba contra Postgres la mitad del «Hecho cuando» de F2.3 que vive en
 * la base: buscar «cable hdmi» encuentra un producto cuya descripción dice
 * `Cable **HDMI** 2.1`.
 *
 * Es la parte que no se ve leyendo el código. `description` guarda Markdown
 * (RF-15) y la sintaxis parte la subcadena, así que la consulta de §10.1 mira
 * `description_text`, la proyección generada. Si esa columna o su índice se
 * cayeran, la búsqueda seguiría compilando y devolvería de menos.
 *
 * Todo corre en una transacción que al final se revierte.
 */
import postgres from "postgres";

try { process.loadEnvFile(".env.local"); } catch {}

// Escribe en la base: no corre contra nada que no sea el stack local.
const { soloLocal } = await import("./solo-local.mts");
soloLocal("db:descripcion");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

// ── La proyección se calcula en la base, no en JavaScript ──────────────
const [generada] = await sql`
  SELECT is_generated, generation_expression
    FROM information_schema.columns
   WHERE table_name = 'products' AND column_name = 'description_text'`;
ok(generada?.is_generated === "ALWAYS", "`description_text` es una columna GENERADA");

// El índice trigrama tiene que estar sobre la proyección. Sobre `description`
// indexaría el texto que §10.1 ya no consulta: costo de escritura sin lectura.
const [indice] = await sql`
  SELECT indexdef FROM pg_indexes WHERE indexname = 'products_description_trgm_idx'`;
ok(
  typeof indice?.indexdef === "string" &&
    indice.indexdef.includes("description_text"),
  "El índice trigrama está sobre `description_text`, no sobre `description`",
);

await sql.begin(async (tx) => {
  const [marca] = await tx`
    INSERT INTO brands (name, slug) VALUES ('Probando HDMI', 'probando-hdmi')
    RETURNING id`;
  const [categoria] = await tx`
    INSERT INTO categories (name, slug) VALUES ('Probando Cables', 'probando-cables')
    RETURNING id`;

  const descripcion = [
    "Cable **HDMI** 2.1 de *alta* velocidad.",
    "",
    "## Qué trae",
    "",
    "- Conector USB-C reforzado",
    "- Modelo XT_500",
  ].join("\n");

  const [producto] = await tx`
    INSERT INTO products (name, slug, description, brand_id, category_id, price)
    VALUES ('Cable de video', 'probando-cable-de-video', ${descripcion},
            ${marca.id}, ${categoria.id}, '9999.00')
    RETURNING id, description_text AS "descriptionText"`;

  const texto = producto.descriptionText as string;

  ok(!/[*#`]/.test(texto), "La proyección se queda sin la sintaxis de Markdown");
  ok(texto.includes("USB-C"), "El guion sobrevive: «USB-C» sigue siendo «USB-C»");
  ok(texto.includes("XT500"), "El guion bajo se va, y solo afecta a la búsqueda");

  /**
   * La consulta de §10.1, recortada a lo que esta prueba mira. El término
   * viaja como PARÁMETRO, nunca interpolado (§16).
   */
  const buscar = (termino: string) => tx`
    WITH q AS (SELECT immutable_unaccent(lower(${termino})) AS term)
    SELECT p.id
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      CROSS JOIN q
     WHERE p.is_active
       AND ( immutable_unaccent(lower(p.name))             ILIKE '%' || q.term || '%'
          OR immutable_unaccent(lower(b.name))             ILIKE '%' || q.term || '%'
          OR immutable_unaccent(lower(p.description_text)) ILIKE '%' || q.term || '%'
          OR immutable_unaccent(lower(p.name)) % q.term
          OR immutable_unaccent(lower(b.name)) % q.term )`;

  const tiene = async (termino: string) =>
    (await buscar(termino)).some((f) => f.id === producto.id);

  ok(await tiene("cable hdmi"), "«cable hdmi» encuentra `Cable **HDMI** 2.1`");
  ok(await tiene("alta velocidad"), "La cursiva tampoco parte la subcadena");

  // Contraprueba: sin la proyección esto es lo que pasaba. Si algún día
  // alguien devuelve la consulta a `description`, esta línea lo delata.
  const [crudo] = await tx`
    SELECT (immutable_unaccent(lower(description)) ILIKE '%cable hdmi%') AS encuentra
      FROM products WHERE id = ${producto.id}`;
  ok(crudo.encuentra === false, "Sobre `description` NO lo encontraría: por eso existe la proyección");

  throw new Error("revertir");
}).catch((e) => {
  if (e.message !== "revertir") throw e;
});

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo en orden. Nada quedó escrito.");
await sql.end();
process.exit(fallos ? 1 : 0);
