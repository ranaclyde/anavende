/**
 * Comprueba las reglas de F2.7 contra Postgres — RF-20, §5.9, §10.3.
 *
 * Lo que se prueba acá es lo que NO se ve leyendo el código:
 *
 *   · Que guardar por primera vez CREE la fila. Es un UPSERT y no un UPDATE
 *     justamente por eso, y con un UPDATE el síntoma sería una pantalla que
 *     dice «se guardó» sin haber guardado nada.
 *   · Que guardar la segunda vez pise la primera y no aparezca una segunda
 *     fila.
 *   · Que el número de WhatsApp quede normalizado igual que el teléfono del
 *     comprador. Los dos salen de `lib/telefono.ts`, y la prueba es lo que
 *     sostiene que sean uno solo.
 *   · Que el listado de productos use el umbral GUARDADO, que es todo el
 *     sentido de la tarea: hasta hoy leía un 3 escrito en el código.
 *
 * Corre con `--conditions=react-server` (ver `package.json`): los módulos que
 * prueba llevan `server-only`.
 *
 * Deja la base como la encontró, incluida la fila de configuración que
 * hubiera antes —o su ausencia—.
 */
import postgres from "postgres";

try { process.loadEnvFile(".env.local"); } catch {}

const { configuracionDelSitio } = await import(
  "../modules/settings/schemas.ts"
);
const { AYUDA_DEL_UMBRAL } = await import("../modules/settings/limites.ts");
const { telefono } = await import("../modules/users/schemas.ts");
const {
  leerLaConfiguracion,
  umbralDeStockBajo,
  UMBRAL_DE_STOCK_BAJO_POR_DEFECTO,
} = await import("../modules/settings/queries.ts");
const { escribirLaConfiguracion } = await import(
  "../modules/settings/service.ts"
);
const { listarProductos } = await import(
  "../modules/catalog/products/queries.ts"
);
const { FILTROS_VACIOS } = await import(
  "../modules/catalog/products/filtros.ts"
);

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

const valido = (entrada: unknown) => configuracionDelSitio.safeParse(entrada);

const base = {
  whatsappNumber: "11 5555 5555",
  adminNotificationEmail: "ventas@anavende.com.ar",
  lowStockThreshold: 3,
};

// ── 1. El número de WhatsApp (RF-04, RF-20) ────────────────────────────
console.log("── El número de WhatsApp (RF-20) ──");

const numero = (v: string) =>
  valido({ ...base, whatsappNumber: v }).data?.whatsappNumber;

ok(
  numero("11 5555 5555") === "+5491155555555",
  "Se guarda normalizado a +549…, sin espacios",
);
ok(
  numero("+54 9 11 5555-5555") === "+5491155555555" &&
    numero("(11) 5555-5555") === "+5491155555555" &&
    numero("5491155555555") === "+5491155555555",
  "Con +54, con 9, con guiones o con paréntesis: la misma fila guardada",
);
ok(
  telefono.safeParse("11 5555 5555").data === numero("11 5555 5555"),
  "El número del sitio y el teléfono del comprador normalizan IGUAL: es la misma implementación",
);
ok(
  !valido({ ...base, whatsappNumber: "" }).success &&
    !valido({ ...base, whatsappNumber: "1155" }).success &&
    !valido({ ...base, whatsappNumber: "no tengo" }).success,
  "Vacío, corto o con letras se rechaza",
);

// ── 2. El email de avisos (E4) ─────────────────────────────────────────
console.log("\n── El email de avisos (RF-20) ──");

const correo = (v: string) =>
  valido({ ...base, adminNotificationEmail: v }).data?.adminNotificationEmail;

ok(
  correo("  Ventas@AnaVende.com.ar  ") === "ventas@anavende.com.ar",
  "Se recorta y se pasa a minúsculas: dos formas de escribir la misma casilla son una sola",
);
ok(
  !valido({ ...base, adminNotificationEmail: "ventas@" }).success &&
    !valido({ ...base, adminNotificationEmail: "" }).success,
  "Un email incompleto o vacío se rechaza",
);

// ── 3. El umbral (RF-20, §10.3) ────────────────────────────────────────
console.log("\n── El umbral de stock bajo (RF-20) ──");

const umbral = (v: unknown) => valido({ ...base, lowStockThreshold: v });

ok(umbral(1).success && umbral(100).success, "1 y 100 entran: son los bordes");
ok(
  !umbral(0).success,
  "0 se rechaza: apagaría el aviso en vez de configurarlo, y «sin stock» ya cubre ese caso",
);
ok(!umbral(101).success, "101 se rechaza: marcaría casi todo el catálogo");
ok(!umbral(3.5).success, "3,5 se rechaza: el stock se cuenta en unidades enteras");
ok(!umbral("3").success, "El texto «3» se rechaza: el formulario convierte, el esquema no adivina");
ok(
  umbral(0).error?.issues[0]?.message === AYUDA_DEL_UMBRAL &&
    umbral(3.5).error?.issues[0]?.message === AYUDA_DEL_UMBRAL,
  "Un umbral mal escrito explica la regla entera, y con el MISMO texto que usa el formulario",
);

// ── 4. Contra Postgres ─────────────────────────────────────────────────
console.log("\n── Guardar y leer (§5.9) ──");

/** Lo que hubiera antes, para dejar la base como estaba. */
const [previa] = await sql<
  {
    whatsappNumber: string;
    adminNotificationEmail: string;
    lowStockThreshold: number;
    updatedAt: Date;
  }[]
>`SELECT whatsapp_number AS "whatsappNumber",
         admin_notification_email AS "adminNotificationEmail",
         low_stock_threshold AS "lowStockThreshold",
         updated_at AS "updatedAt"
    FROM site_settings WHERE id = 1`;

const productos: string[] = [];
let marcaId = "";
let categoriaId = "";

try {
  await sql`DELETE FROM site_settings WHERE id = 1`;

  ok(
    (await leerLaConfiguracion()) === null,
    "Sin fila, la configuración se lee como «todavía no se guardó» y no como valores vacíos",
  );
  ok(
    (await umbralDeStockBajo()) === UMBRAL_DE_STOCK_BAJO_POR_DEFECTO,
    `Sin fila, el umbral es el del código (${UMBRAL_DE_STOCK_BAJO_POR_DEFECTO}) y el listado no se cae`,
  );

  const primera = await escribirLaConfiguracion(
    valido({ ...base, whatsappNumber: "11 5555 5555" }).data!,
  );

  ok(
    primera.whatsappNumber === "+5491155555555" &&
      primera.lowStockThreshold === 3,
    "La PRIMERA vez crea la fila: con un UPDATE, la pantalla diría «se guardó» sin nada guardado",
  );
  ok(
    primera.whatsappNumber ===
      (await leerLaConfiguracion())?.whatsappNumber,
    "Lo que devuelve guardar es lo que después se lee",
  );

  const [{ n: cuantas }] =
    await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM site_settings`;
  ok(cuantas === 1, "Hay una sola fila");

  const [antes] = await sql<
    { updatedAt: Date }[]
  >`SELECT updated_at AS "updatedAt" FROM site_settings WHERE id = 1`;

  const segunda = await escribirLaConfiguracion(
    valido({
      whatsappNumber: "3512223344",
      adminNotificationEmail: "avisos@anavende.com.ar",
      lowStockThreshold: 7,
    }).data!,
  );

  const [despues] = await sql<
    { updatedAt: Date; n: number }[]
  >`SELECT updated_at AS "updatedAt",
           (SELECT count(*)::int FROM site_settings) AS n
      FROM site_settings WHERE id = 1`;

  ok(
    despues.n === 1 && segunda.lowStockThreshold === 7,
    "La SEGUNDA vez pisa la primera y no aparece una segunda fila",
  );
  ok(
    despues.updatedAt > antes.updatedAt,
    "`updated_at` avanza al pisar: su DEFAULT solo corre al insertar, así que hay que escribirlo",
  );
  ok(
    !(await sql`INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
                VALUES (2, '+5491155555555', 'x@y.com')`.catch(() => null)),
    "Una segunda fila la rechaza el CHECK `singleton`, no la buena voluntad del código",
  );

  // ── 5. El umbral guardado es el que usa el listado (§10.3) ───────────
  console.log("\n── El umbral llega al listado (§10.3) ──");

  const marca = Date.now();
  const [b] = await sql<{ id: string }[]>`
    INSERT INTO brands (name, slug) VALUES (${`C${marca}`}, ${`c-${marca}`})
    RETURNING id`;
  marcaId = b.id;
  const [c] = await sql<{ id: string }[]>`
    INSERT INTO categories (name, slug) VALUES (${`C${marca}`}, ${`c-${marca}`})
    RETURNING id`;
  categoriaId = c.id;

  const [p] = await sql<{ id: string }[]>`
    INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
    VALUES (${`Producto ${marca}`}, ${`producto-${marca}`}, ${marcaId},
            ${categoriaId}, 1000.00, true)
    RETURNING id`;
  productos.push(p.id);

  // Cinco unidades disponibles: justo el borde que el umbral va a mover.
  await sql`
    INSERT INTO product_variants (product_id, color_id, stock_total, reserved_stock)
    VALUES (${p.id}, NULL, 5, 0)`;

  const paraReponer = async () => {
    const filas = await listarProductos(
      { ...FILTROS_VACIOS, stock: "reponer" },
      await umbralDeStockBajo(),
    );
    return filas.some((f) => f.id === p.id);
  };

  await escribirLaConfiguracion(valido({ ...base, lowStockThreshold: 5 }).data!);
  ok(
    (await umbralDeStockBajo()) === 5,
    "El umbral que se lee es el guardado, no el del código",
  );
  ok(
    await paraReponer(),
    "Con umbral 5, un producto con 5 disponibles entra en «Para reponer»",
  );

  await escribirLaConfiguracion(valido({ ...base, lowStockThreshold: 4 }).data!);
  ok(
    !(await paraReponer()),
    "Con umbral 4, el mismo producto sale del filtro: cambiar el número cambió el listado",
  );
} finally {
  if (productos.length) {
    await sql`DELETE FROM products WHERE id = ANY(${productos})`;
  }
  if (marcaId) await sql`DELETE FROM brands WHERE id = ${marcaId}`;
  if (categoriaId) await sql`DELETE FROM categories WHERE id = ${categoriaId}`;

  await sql`DELETE FROM site_settings WHERE id = 1`;
  if (previa) {
    await sql`
      INSERT INTO site_settings (id, whatsapp_number, admin_notification_email,
                                 low_stock_threshold, updated_at)
      VALUES (1, ${previa.whatsappNumber}, ${previa.adminNotificationEmail},
              ${previa.lowStockThreshold}, ${previa.updatedAt})`;
  }
}

console.log(
  fallos
    ? `\n${fallos} fallo(s)`
    : "\nTodo en orden. La configuración quedó como estaba.",
);
await sql.end();
process.exit(fallos ? 1 : 0);
