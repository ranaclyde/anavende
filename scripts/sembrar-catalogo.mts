/**
 * Catálogo de demostración para construir F3 — 26 productos.
 *
 *   npm run seed            # siembra
 *   npm run seed:limpiar    # borra lo que sembró, y nada más
 *
 * **Por qué existe, y por qué es un script y no un test.** F3 son pantallas:
 * tarjeta, catálogo, ficha, home. Sin productos no hay nada que mirar, y el
 * catálogo real es de Ana y todavía no existe (F2.8). Esto llena el hueco
 * mientras tanto, y se va de un comando.
 *
 * **Lo que NO reemplaza.** F3.3 pide el umbral de similitud «calibrado con el
 * catálogo real», y eso es literal: calibrarlo contra 26 nombres que elegimos
 * nosotros daría un número que no sirve para 200 productos de verdad. Lo mismo
 * la Compuerta F3 —«una persona ajena encuentra un producto concreto»—, que
 * contra un catálogo propio se aprueba sola. Las dos siguen esperando a Ana.
 *
 * **Las imágenes son de verdad**, no URLs de un servicio de placeholders: pasan
 * por `publicarImagenDeVariante`, o sea por sharp, los tres tamaños y Storage.
 * Es lo que hace que la grilla se vea con los pesos y las proporciones que va a
 * tener, y que el `next/image` de la tienda esté leyendo lo que va a leer.
 */
import sharp from "sharp";

process.loadEnvFile(".env.local");

// ── Las dos puertas ────────────────────────────────────────────────────
//
// Esto escribe filas y sube archivos. Contra producción entraría inventario de
// mentira en el catálogo de Ana, con fotos en el bucket — y un archivo huérfano
// en Storage no lo encuentra nadie y no lo borra nadie.
//
// Se comprueban las DOS, base y Storage, porque apuntar bien una no dice nada
// de la otra. Es la misma regla que usan los tests, importada y no copiada.
const { esApiDelStackLocal, esStackLocal, dondeApunta } = await import(
  "./solo-local.mts"
);

const baseUrl = process.env.DATABASE_URL ?? "";
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

if (!esStackLocal(baseUrl) || !esApiDelStackLocal(apiUrl)) {
  console.error(
    `✋ El seed escribe filas y sube archivos, y no está apuntando al stack local.\n` +
      `   base:    ${baseUrl ? dondeApunta(baseUrl) : "sin definir"}  (tiene que ser loopback:54322)\n` +
      `   storage: ${apiUrl ? dondeApunta(apiUrl, "") : "sin definir"}  (tiene que ser loopback:54321)\n\n` +
      `   Con el stack levantado (npm run dev:stack), .env.local sale de\n` +
      `   .env.stack-local.bak. Contra producción esto entra en el catálogo real.\n`,
  );
  process.exit(1);
}

const postgres = (await import("postgres")).default;
const { publicarImagenDeVariante } = await import("../modules/media/subir.ts");
const { clavesDeProducto, borrarArchivos } = await import(
  "../modules/media/subir.ts"
);

const sql = postgres(baseUrl, { max: 1 });

/** Todo lo que siembra este script lleva este prefijo en el slug. */
const PREFIJO = "demo-";

/** El residuo de los tests: `Producto <8 hex>`, `Marca …`, `Rubro …`. */
const RESIDUO = "^(producto|marca|rubro)-[0-9a-f]{8}$";

// ─────────────────────────────────────────────────────────────────────────
// Limpieza
// ─────────────────────────────────────────────────────────────────────────

async function limpiar() {
  const productos = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM products
     WHERE slug LIKE ${PREFIJO + "%"} OR slug ~ ${RESIDUO}`;

  // Los archivos se leen ANTES del DELETE: la cascada se lleva variant_images
  // y con ella la única referencia a lo que hay en el bucket.
  for (const p of productos) {
    const claves = await clavesDeProducto(p.id);
    if (claves.length) await borrarArchivos(claves);
  }

  const borrados = {
    productos: productos.length,
    marcas: 0,
    categorias: 0,
    colores: 0,
  };

  if (productos.length) {
    await sql`DELETE FROM products WHERE id = ANY(${productos.map((p) => p.id)})`;
  }

  // Marcas, categorías y colores: solo los que quedaron SIN USO. Un `Logitech`
  // cargado a mano no se toca aunque el seed también lo use.
  const enUso = sql`SELECT 1 FROM products p WHERE p.brand_id = b.id`;
  borrados.marcas = (
    await sql`DELETE FROM brands b
               WHERE (b.slug LIKE ${PREFIJO + "%"} OR b.slug ~ ${RESIDUO})
                 AND NOT EXISTS (${enUso}) RETURNING b.id`
  ).length;
  borrados.categorias = (
    await sql`DELETE FROM categories c
               WHERE (c.slug LIKE ${PREFIJO + "%"} OR c.slug ~ ${RESIDUO})
                 AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id)
               RETURNING c.id`
  ).length;
  borrados.colores = (
    await sql`DELETE FROM colors c
               WHERE c.slug LIKE ${PREFIJO + "%"}
                 AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.color_id = c.id)
               RETURNING c.id`
  ).length;

  return borrados;
}

// ─────────────────────────────────────────────────────────────────────────
// Imágenes
// ─────────────────────────────────────────────────────────────────────────

/**
 * Una foto de relleno con el nombre del producto escrito encima.
 *
 * Rellenos con el nombre a la vista y no rectángulos de color: con 26 productos
 * en una grilla, una tarjeta que no dice cuál es no sirve para juzgar el
 * layout. El fondo es acromático a propósito (DESIGN-REFERENCE §11: «dejar que
 * la foto del producto ponga el color»), con el tono variando por índice para
 * que las tarjetas se distingan sin meter un segundo color saturado.
 */
async function foto(titulo: string, subtitulo: string, tono: number) {
  const claro = 88 - (tono % 5) * 6;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
      <rect width="1200" height="1200" fill="hsl(210 8% ${claro}%)"/>
      <rect x="90" y="90" width="1020" height="1020" rx="48"
            fill="none" stroke="hsl(210 8% ${claro - 12}%)" stroke-width="3"/>
      <text x="600" y="565" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="74"
            font-weight="600" fill="hsl(210 10% 22%)">${escapar(titulo)}</text>
      <text x="600" y="665" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="46"
            fill="hsl(210 8% 42%)">${escapar(subtitulo)}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ─────────────────────────────────────────────────────────────────────────
// El catálogo
// ─────────────────────────────────────────────────────────────────────────

type Variante = { color: string | null; stock: number; fotos?: number };

type Semilla = {
  nombre: string;
  marca: string;
  categoria: string;
  precio: number;
  descuento?: number;
  destacado?: boolean;
  activo?: boolean;
  descripcion?: string;
  dias?: number;
  variantes: Variante[];
};

/**
 * Los primeros nueve existen por un ESTADO que alguna pantalla de F3 tiene que
 * poder mostrar; los demás son volumen para que la grilla y la paginación se
 * vean con el peso real. La paginación es de 24 por página (§10.2), así que 26
 * es el mínimo que produce una segunda página.
 */
const CATALOGO: Semilla[] = [
  // ── Los nueve que cubren estados ──
  {
    // Con descuento + destacado + varios colores + varias fotos: el que
    // ejercita casi toda la ficha (F3.5) y la etiqueta de oferta (F3.1).
    nombre: "Teclado Mecánico K120",
    marca: "Logitech", categoria: "Teclados",
    precio: 27500, descuento: 3000, destacado: true, dias: 3,
    descripcion:
      "Teclado **mecánico** de perfil bajo, con switches lineales.\n\n" +
      "## Qué trae\n\n- Cable USB-C desmontable\n- Apoya muñecas\n- Teclas *retroiluminadas*",
    variantes: [
      { color: "Negro", stock: 8, fotos: 3 },
      { color: "Blanco", stock: 3, fotos: 3 },
    ],
  },
  {
    // SIN STOCK: la tarjeta tiene que seguir siendo clicable (RN-05).
    nombre: "Auricular H390",
    marca: "Logitech", categoria: "Auriculares",
    precio: 18900, dias: 9,
    variantes: [{ color: "Negro", stock: 0, fotos: 1 }],
  },
  {
    // SIN FOTOS: el estado que nadie prueba y siempre aparece.
    nombre: "Cable USB-C a USB-C 2 m",
    marca: "Genérica", categoria: "Cables",
    precio: 3200, dias: 11,
    variantes: [{ color: null, stock: 14, fotos: 0 }],
  },
  {
    // «Único», sin color: el otro camino de la ficha (RF-16).
    nombre: "Cable HDMI 2.1",
    marca: "Genérica", categoria: "Cables",
    precio: 4500, dias: 6,
    descripcion:
      "Soporta **8K a 60Hz** y 4K a 120Hz. Conector reforzado, 2 metros.",
    variantes: [{ color: null, stock: 20, fotos: 2 }],
  },
  {
    // El más caro, con el descuento más grande: mide el ancho del precio.
    nombre: "Teclado MX Keys",
    marca: "Logitech", categoria: "Teclados",
    precio: 145000, descuento: 15000, destacado: true, dias: 1,
    variantes: [{ color: "Negro", stock: 2, fotos: 3 }],
  },
  {
    // Un color agotado entre otros con stock: el selector tiene que tacharlo.
    nombre: "Mouse G203 Lightsync",
    marca: "Logitech", categoria: "Mouses",
    precio: 12800, dias: 4,
    variantes: [
      { color: "Negro", stock: 12, fotos: 2 },
      { color: "Blanco", stock: 4, fotos: 1 },
      { color: "Azul", stock: 0, fotos: 1 },
    ],
  },
  {
    // Nombre con acento: «mecanico» tiene que encontrarlo (F3.3).
    nombre: "Teclado Mecánico Kumara K552",
    marca: "Redragon", categoria: "Teclados",
    precio: 21900, descuento: 1900, destacado: true, dias: 5,
    variantes: [{ color: "Negro", stock: 5, fotos: 2 }],
  },
  {
    nombre: "Auricular Cloud II",
    marca: "HyperX", categoria: "Auriculares",
    precio: 89900, descuento: 9900, destacado: true, dias: 2,
    variantes: [
      { color: "Rojo", stock: 3, fotos: 2 },
      { color: "Negro", stock: 1, fotos: 1 },
    ],
  },
  {
    // INACTIVO: no tiene que aparecer en la tienda, y la ficha da 404 (F3.5).
    nombre: "Mouse Cobra Pro",
    marca: "Redragon", categoria: "Mouses",
    precio: 34900, activo: false, dias: 8,
    variantes: [{ color: "Negro", stock: 6, fotos: 1 }],
  },

  // ── Volumen, para que la grilla y la paginación pesen ──
  ...relleno(),
];

function relleno(): Semilla[] {
  const items: [string, string, string, number, number?][] = [
    ["Teclado G413 TKL", "Logitech", "Teclados", 62000],
    ["Teclado K380 Multidispositivo", "Logitech", "Teclados", 48500, 4500],
    ["Teclado Vara K552 RGB", "Redragon", "Teclados", 33900],
    ["Teclado Alloy Origins", "HyperX", "Teclados", 118000, 8000],
    ["Mouse G502 Hero", "Logitech", "Mouses", 74900, 5900],
    ["Mouse M170 Inalámbrico", "Logitech", "Mouses", 11200],
    ["Mouse Pulsefire Core", "HyperX", "Mouses", 39900],
    ["Mouse Storm Elite", "Redragon", "Mouses", 27400, 2400],
    ["Mouse M720 Triathlon", "Logitech", "Mouses", 68900],
    ["Auricular Zeus X", "Redragon", "Auriculares", 52900, 3900],
    ["Auricular Cloud Stinger", "HyperX", "Auriculares", 44900],
    ["Auricular G335", "Logitech", "Auriculares", 71500, 6500],
    ["Auricular Pandora H350", "Redragon", "Auriculares", 29900],
    ["Cable DisplayPort 1.4", "Genérica", "Cables", 6800],
    ["Cable USB-A a USB-C 1 m", "Genérica", "Cables", 2400],
    ["Cable de red Cat6 3 m", "Genérica", "Cables", 3900],
    ["Cable Thunderbolt 4", "Genérica", "Cables", 22900, 1900],
  ];

  return items.map(([nombre, marca, categoria, precio, descuento], i) => ({
    nombre, marca, categoria, precio, descuento,
    dias: 12 + i,
    variantes: [
      { color: i % 3 === 0 ? "Negro" : i % 3 === 1 ? "Blanco" : null,
        stock: [7, 15, 2, 30, 4][i % 5], fotos: 1 },
    ],
  }));
}

// ─────────────────────────────────────────────────────────────────────────

const slug = (s: string) =>
  PREFIJO +
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Crea si no está, y devuelve el id en los dos casos. */
async function idDe(
  tabla: "brands" | "categories" | "colors",
  nombre: string,
  extra: Record<string, unknown> = {},
) {
  const existente = await sql<{ id: string }[]>`
    SELECT id FROM ${sql(tabla)} WHERE lower(name) = lower(${nombre})`;
  if (existente.length) return existente[0].id;

  const fila = { name: nombre, slug: slug(nombre), ...extra };
  const [creada] = await sql<{ id: string }[]>`
    INSERT INTO ${sql(tabla)} ${sql(fila)} RETURNING id`;
  return creada.id;
}

async function sembrar() {
  const colores: Record<string, string> = {};
  for (const [nombre, hex] of [
    ["Negro", "#1c1e21"], ["Blanco", "#f4f5f6"],
    ["Rojo", "#8f2b2b"], ["Azul", "#26456e"],
  ] as const) {
    colores[nombre] = await idDe("colors", nombre, { hex_code: hex });
  }

  const marcas: Record<string, string> = {};
  const categorias: Record<string, string> = {};
  let n = 0;

  for (const s of CATALOGO) {
    marcas[s.marca] ??= await idDe("brands", s.marca);
    categorias[s.categoria] ??= await idDe("categories", s.categoria);

    const [p] = await sql<{ id: string }[]>`
      INSERT INTO products (name, slug, description, brand_id, category_id,
                            price, discount, is_featured, is_active, created_at)
      VALUES (${s.nombre}, ${slug(s.nombre)}, ${s.descripcion ?? ""},
              ${marcas[s.marca]}, ${categorias[s.categoria]},
              ${s.precio.toFixed(2)}, ${(s.descuento ?? 0).toFixed(2)},
              ${s.destacado ?? false}, ${s.activo ?? true},
              now() - make_interval(days => ${s.dias ?? 0}))
      RETURNING id`;

    for (const v of s.variantes) {
      const [variante] = await sql<{ id: string }[]>`
        INSERT INTO product_variants (product_id, color_id, stock_total)
        VALUES (${p.id}, ${v.color ? colores[v.color] : null}, ${v.stock})
        RETURNING id`;

      for (let i = 0; i < (v.fotos ?? 0); i++) {
        await publicarImagenDeVariante({
          productId: p.id,
          variantId: variante.id,
          archivo: await foto(s.nombre, v.color ?? "Único", n + i),
          altText: `${s.nombre} ${s.marca}${v.color ? `, ${v.color.toLowerCase()}` : ""}`,
        });
      }
    }

    n++;
    process.stdout.write(`\r   ${n}/${CATALOGO.length} productos…`);
  }
  process.stdout.write("\r".padEnd(40) + "\r");
  return n;
}

// ─────────────────────────────────────────────────────────────────────────

const modo = process.argv[2] === "--limpiar" ? "limpiar" : "sembrar";

if (modo === "limpiar") {
  const b = await limpiar();
  console.log(
    `Borrados: ${b.productos} productos, ${b.marcas} marcas, ` +
      `${b.categorias} categorías, ${b.colores} colores.`,
  );
} else {
  const previos = await limpiar();
  if (previos.productos) {
    console.log(`Limpieza previa: ${previos.productos} productos.`);
  }
  const cuantos = await sembrar();

  await sql`
    UPDATE categories SET is_featured = true
     WHERE lower(name) IN ('teclados', 'mouses', 'auriculares', 'cables')`;

  const [{ n: fotos }] =
    await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM variant_images`;
  console.log(
    `Sembrados ${cuantos} productos con ${fotos} imágenes.\n` +
      `Para verlos:  npm run dev  →  http://localhost:3000\n` +
      `Para borrarlos:  npm run seed:limpiar`,
  );
}

await sql.end();
