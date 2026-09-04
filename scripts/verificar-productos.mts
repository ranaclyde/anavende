/**
 * Comprueba las reglas de F2.3 que no se ven leyendo el código: RN-04b sobre
 * los dos campos a la vez, la sanitización como parte de la validación, y
 * RN-11b al revés —no activar un producto de marca o categoría inactiva—
 * contra Postgres.
 *
 * Todo lo que toca la base corre en una transacción que al final se revierte.
 */
import { z } from "zod";
import postgres from "postgres";

import {
  crearProducto,
  editarProducto,
} from "../modules/catalog/products/schemas.ts";

try { process.loadEnvFile(".env.local"); } catch {}

// Escribe en la base: no corre contra nada que no sea el stack local.
const { soloLocal } = await import("./solo-local.mts");
soloLocal("db:productos");

let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

const base = {
  name: "Teclado mecánico K120",
  brandId: crypto.randomUUID(),
  categoryId: crypto.randomUUID(),
};

/** El primer mensaje colgado de un campo, como lo lee `lib/form.ts`. */
function errorDe(resultado: z.ZodSafeParseResult<unknown>, campo: string) {
  if (resultado.success) return null;
  const arbol = z.treeifyError(resultado.error) as {
    properties?: Record<string, { errors?: string[] }>;
  };
  return arbol.properties?.[campo]?.errors?.[0] ?? null;
}

console.log("── Validación (RF-15, RN-04b) ──");

// ── El precio ───────────────────────────────────────────────────────────

const conComa = crearProducto.safeParse({ ...base, price: "1000,50" });
ok(
  conComa.success && conComa.data.price === "1000.50",
  "El precio con coma decimal se acepta y se normaliza a punto",
);
ok(
  conComa.success && conComa.data.discount === "0.00",
  "Sin descuento, el descuento es cero: no hay oferta (RN-04b)",
);

ok(
  errorDe(crearProducto.safeParse({ ...base, price: "0" }), "price") !== null,
  "Un precio de cero se rechaza",
);
ok(
  errorDe(crearProducto.safeParse({ ...base, price: "-5" }), "price") !== null,
  "Un precio negativo se rechaza",
);
ok(
  errorDe(crearProducto.safeParse({ ...base, price: "diez mil" }), "price") !== null,
  "Un precio que no es un monto se rechaza",
);

// ── El descuento, que necesita mirar el precio (RN-04b) ─────────────────

const igual = crearProducto.safeParse({ ...base, price: "1000", discount: "1000" });
ok(
  errorDe(igual, "discount") === "El descuento tiene que ser menor que el precio.",
  "Un descuento IGUAL al precio se rechaza, y el error queda en el descuento",
);
ok(errorDe(igual, "price") === null, "El precio no se marca: el que hay que corregir es el descuento");

ok(
  errorDe(crearProducto.safeParse({ ...base, price: "1000", discount: "1500" }), "discount") !== null,
  "Un descuento MAYOR al precio se rechaza",
);
ok(
  errorDe(crearProducto.safeParse({ ...base, price: "1000", discount: "-1" }), "discount") !== null,
  "Un descuento negativo se rechaza",
);
ok(
  crearProducto.safeParse({ ...base, price: "1000", discount: "999.99" }).success,
  "Un descuento de un centavo menos que el precio se acepta",
);

// ── La descripción se sanitiza AL VALIDAR (§16) ─────────────────────────

const conBasura = crearProducto.safeParse({
  ...base,
  price: "1000",
  description: 'Ver [manual](https://x.com) **acá**.\n\n<script>alert(1)</script>',
});
ok(
  conBasura.success && conBasura.data.description === "Ver manual **acá**.",
  "La descripción sale sanitizada de la validación, no de un paso aparte",
);

const largaEnMarkdown = "**" + "a".repeat(4999) + "**";
ok(
  crearProducto.safeParse({ ...base, price: "1000", description: largaEnMarkdown }).success,
  "El límite cuenta el texto: poner en negrita no acerca al tope",
);
ok(
  errorDe(
    crearProducto.safeParse({ ...base, price: "1000", description: "a".repeat(5001) }),
    "description",
  ) !== null,
  "Un texto de más de 5.000 caracteres se rechaza",
);
ok(
  crearProducto.safeParse({ ...base, price: "1000" }).success,
  "Una descripción vacía es válida (RF-15)",
);

// Editar exige `id`; el resto de las reglas son las mismas.
ok(
  !editarProducto.safeParse({ ...base, price: "1000" }).success,
  "Editar sin `id` se rechaza",
);
ok(
  editarProducto.safeParse({ ...base, id: crypto.randomUUID(), price: "1000" }).success,
  "Editar con `id` y datos válidos se acepta",
);

// ── RN-11b al revés, contra la base ─────────────────────────────────────

console.log("\n── RN-11b: no activar contra algo inactivo ──");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

await sql.begin(async (tx) => {
  const [marcaOff] = await tx`
    INSERT INTO brands (name, slug, is_active)
    VALUES ('Probando Marca Off', 'probando-marca-off', false) RETURNING id`;
  const [categoriaOn] = await tx`
    INSERT INTO categories (name, slug) VALUES ('Probando Cat On', 'probando-cat-on')
    RETURNING id`;

  /**
   * La consulta que sostiene la regla: un producto no puede quedar activo si
   * su marca o su categoría no lo están. Es la MISMA que corre la acción.
   */
  const inactivos = async (brandId: string, categoryId: string) => {
    const [f] = await tx`
      SELECT (SELECT NOT is_active FROM brands     WHERE id = ${brandId})    AS marca,
             (SELECT NOT is_active FROM categories WHERE id = ${categoryId}) AS categoria`;
    return f as { marca: boolean; categoria: boolean };
  };

  const conMarcaApagada = await inactivos(marcaOff.id, categoriaOn.id);
  ok(conMarcaApagada.marca === true, "La consulta detecta la marca inactiva");
  ok(conMarcaApagada.categoria === false, "…y no confunde la categoría activa");

  // Un producto INACTIVO de marca inactiva es válido: RN-11b solo prohíbe la
  // combinación activo + inactivo. Guardar el borrador tiene que poder.
  const [producto] = await tx`
    INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
    VALUES ('Probando Producto', 'probando-producto', ${marcaOff.id}, ${categoriaOn.id},
            '1000.00', false)
    RETURNING id, is_active AS "isActive"`;
  ok(producto.isActive === false, "Un producto inactivo de marca inactiva se guarda");

  // Y el CHECK de la base sigue siendo la última barrera sobre el descuento.
  let rechazado = false;
  try {
    await tx.savepoint(async (sp) => {
      await sp`UPDATE products SET discount = price WHERE id = ${producto.id}`;
    });
  } catch {
    rechazado = true;
  }
  ok(rechazado, "La base rechaza un descuento igual al precio, aunque la validación falle");

  throw new Error("revertir");
}).catch((e) => {
  if (e.message !== "revertir") throw e;
});

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo en orden. Nada quedó escrito.");
await sql.end();
process.exit(fallos ? 1 : 0);
