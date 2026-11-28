/**
 * Catálogo de demostración para el stack local, con configuración y medios de
 * pago para que la tienda se pueda mirar entera. Las fotos pasan por la
 * canalización real (sharp y Storage).
 *
 *   npm run seed            # siembra
 *   npm run seed:limpiar    # borra lo que sembró, y nada más
 *
 * Los tests de configuración borran la fila de `site_settings`: después de
 * `npm test` hay que volver a sembrar.
 */
import sharp from "sharp";

process.loadEnvFile(".env.local");

// Escribe filas y sube archivos: contra producción entraría en el catálogo
// real. Se comprueban base y Storage, porque una no dice nada de la otra.
const { esApiDelStackLocal, esStackLocal, dondeApunta } =
  await import("./solo-local.mts");

const baseUrl = process.env.DATABASE_URL ?? "";
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

if (!esStackLocal(baseUrl) || !esApiDelStackLocal(apiUrl)) {
  console.error(
    `✋ El seed escribe filas y sube archivos, y no está apuntando al stack local.\n` +
      `   base:    ${baseUrl ? dondeApunta(baseUrl) : "sin definir"}  (tiene que ser loopback:54322)\n` +
      `   storage: ${apiUrl ? dondeApunta(apiUrl, "") : "sin definir"}  (tiene que ser loopback:54321)\n\n` +
      `   Con el stack levantado (npm run dev:stack), .env.local tiene que\n` +
      `   tener los valores de \`npx supabase status\`. Contra producción esto\n` +
      `   entra en el catálogo real.\n`,
  );
  process.exit(1);
}

const postgres = (await import("postgres")).default;
const { publicarImagenDeVariante } = await import("../modules/media/subir.ts");
const { clavesDeProducto, clavesDelLogo, publicarLogo, borrarArchivos } =
  await import("../modules/media/subir.ts");

const sql = postgres(baseUrl, { max: 1 });

/** Todo lo que siembra este script lleva este prefijo en el slug. */
const PREFIJO = "demo-";

/** El residuo de los tests: `Producto <8 hex>`, `Marca …`, `Rubro …`. */
const RESIDUO = "^(producto|marca|rubro)-[0-9a-f]{8}$";

/**
 * Sin WhatsApp la ficha no tiene su acción, y ninguna migración escribe
 * `site_settings` (§5.9). El número es falso a propósito: si esto corriera
 * donde no debe, no le llegaría nada a nadie.
 */
const CONFIGURACION = {
  whatsapp: "+5491100000000",
  email: "demo@anavende.invalid",
};

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
    configuracion: 0,
    pagos: 0,
  };

  // Los archivos primero, como con las fotos: la clave se va con la fila.
  const pagos = await sql<{ id: string }[]>`
    SELECT id FROM payment_methods WHERE description = ${MARCA_DE_DEMO}`;

  for (const pago of pagos) {
    const claves = await clavesDelLogo("medio-de-pago", pago.id);
    if (claves.length) await borrarArchivos(claves);
  }

  if (pagos.length) {
    borrados.pagos = (
      await sql`DELETE FROM payment_methods
                 WHERE id = ANY(${pagos.map((p) => p.id)}) RETURNING id`
    ).length;
  }

  if (productos.length) {
    await sql`DELETE FROM products WHERE id = ANY(${productos.map((p) => p.id)})`;
  }

  // Solo los que quedaron sin uso: un `Logitech` cargado a mano no se toca.
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

  // Solo si sigue siendo la del seed: si alguien la editó, no se toca.
  borrados.configuracion = (
    await sql`DELETE FROM site_settings
               WHERE id = 1
                 AND whatsapp_number = ${CONFIGURACION.whatsapp}
                 AND admin_notification_email = ${CONFIGURACION.email}
               RETURNING id`
  ).length;

  return borrados;
}

/** Solo si no hay: nunca pisa la configuración que alguien guardó. */
async function sembrarConfiguracion() {
  const [fila] = await sql<{ id: number }[]>`
    INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
    VALUES (1, ${CONFIGURACION.whatsapp}, ${CONFIGURACION.email})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`;

  return { configuracion: Boolean(fila) };
}

/** Una foto de relleno con el nombre escrito, en gris (DESIGN-REFERENCE §11). */
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

/**
 * Ocho destacadas a propósito: la home muestra siete (§7.1), y así el tope se
 * ve funcionar. Las no destacadas llenan «Más categorías».
 */
const CATEGORIAS: { nombre: string; destacada: boolean }[] = [
  { nombre: "Auriculares", destacada: true },
  { nombre: "Cables", destacada: true },
  { nombre: "Monitores", destacada: true },
  { nombre: "Mouses", destacada: true },
  { nombre: "Parlantes", destacada: true },
  { nombre: "Sillas", destacada: true },
  { nombre: "Teclados", destacada: true },
  { nombre: "Webcams", destacada: true },
  { nombre: "Adaptadores", destacada: false },
  { nombre: "Alfombrillas", destacada: false },
  { nombre: "Hubs USB", destacada: false },
  { nombre: "Micrófonos", destacada: false },
];

/**
 * La descripción marca las filas del seed: `--limpiar` solo se lleva las que
 * siguen diciendo esto. «Efectivo» va sin logo a propósito: la hilera de la
 * home (§7.1) tiene que saber dejarlo afuera.
 */
const MARCA_DE_DEMO = "Cargado por el seed de demostración.";

const MEDIOS_DE_PAGO: { nombre: string; conLogo: boolean }[] = [
  { nombre: "Transferencia", conLogo: true },
  { nombre: "Visa", conLogo: true },
  { nombre: "Mastercard", conLogo: true },
  { nombre: "Cabal", conLogo: true },
  { nombre: "Efectivo", conLogo: false },
];

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
 * Los primeros nueve cubren un estado de la tienda cada uno; el resto es
 * volumen para que haya segunda página (24 por página, §10.2).
 */
const CATALOGO: Semilla[] = [
  {
    // Descuento, destacado, varios colores y fotos: casi toda la ficha.
    nombre: "Teclado Mecánico K120",
    marca: "Logitech",
    categoria: "Teclados",
    precio: 27500,
    descuento: 3000,
    destacado: true,
    dias: 3,
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
    marca: "Logitech",
    categoria: "Auriculares",
    precio: 18900,
    dias: 9,
    variantes: [{ color: "Negro", stock: 0, fotos: 1 }],
  },
  {
    // Sin fotos.
    nombre: "Cable USB-C a USB-C 2 m",
    marca: "Genérica",
    categoria: "Cables",
    precio: 3200,
    dias: 11,
    variantes: [{ color: null, stock: 14, fotos: 0 }],
  },
  {
    // «Único», sin color: el otro camino de la ficha (RF-16).
    nombre: "Cable HDMI 2.1",
    marca: "Genérica",
    categoria: "Cables",
    precio: 4500,
    dias: 6,
    descripcion:
      "Soporta **8K a 60Hz** y 4K a 120Hz. Conector reforzado, 2 metros.",
    variantes: [{ color: null, stock: 20, fotos: 2 }],
  },
  {
    // El más caro, con el descuento más grande: mide el ancho del precio.
    nombre: "Teclado MX Keys",
    marca: "Logitech",
    categoria: "Teclados",
    precio: 145000,
    descuento: 15000,
    destacado: true,
    dias: 1,
    variantes: [{ color: "Negro", stock: 2, fotos: 3 }],
  },
  {
    // Un color agotado entre otros con stock: el selector tiene que tacharlo.
    nombre: "Mouse G203 Lightsync",
    marca: "Logitech",
    categoria: "Mouses",
    precio: 12800,
    dias: 4,
    variantes: [
      { color: "Negro", stock: 12, fotos: 2 },
      { color: "Blanco", stock: 4, fotos: 1 },
      { color: "Azul", stock: 0, fotos: 1 },
    ],
  },
  {
    // Nombre con acento: «mecanico» tiene que encontrarlo.
    nombre: "Teclado Mecánico Kumara K552",
    marca: "Redragon",
    categoria: "Teclados",
    precio: 21900,
    descuento: 1900,
    destacado: true,
    dias: 5,
    variantes: [{ color: "Negro", stock: 5, fotos: 2 }],
  },
  {
    nombre: "Auricular Cloud II",
    marca: "HyperX",
    categoria: "Auriculares",
    precio: 89900,
    descuento: 9900,
    destacado: true,
    dias: 2,
    variantes: [
      { color: "Rojo", stock: 3, fotos: 2 },
      { color: "Negro", stock: 1, fotos: 1 },
    ],
  },
  {
    // Inactivo: no aparece en la tienda y la ficha da 404.
    nombre: "Mouse Cobra Pro",
    marca: "Redragon",
    categoria: "Mouses",
    precio: 34900,
    activo: false,
    dias: 8,
    variantes: [{ color: "Negro", stock: 6, fotos: 1 }],
  },

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

    // Cuatro por destacada: la fila de la home en escritorio es de cuatro.
    ["Monitor AOC 24 pulgadas", "AOC", "Monitores", 189000],
    ["Monitor AOC 27 Curvo", "AOC", "Monitores", 289000, 20000],
    ["Monitor Gamer 165 Hz", "AOC", "Monitores", 344000],
    ["Monitor Portátil 15,6", "AOC", "Monitores", 231000, 16000],
    ["Parlante Z120", "Logitech", "Parlantes", 15900],
    ["Parlante Z200", "Logitech", "Parlantes", 28400, 2400],
    ["Barra de Sonido Z337", "Logitech", "Parlantes", 96500],
    ["Parlante Bluetooth Compacto", "Genérica", "Parlantes", 19900],
    ["Silla Gamer Coeus", "Redragon", "Sillas", 289000, 25000],
    ["Silla Gamer Titán", "Redragon", "Sillas", 342000],
    ["Silla de Oficina Ergonómica", "Genérica", "Sillas", 198000],
    ["Silla Gamer Junior", "Redragon", "Sillas", 176000, 12000],
    ["Webcam C920 HD", "Logitech", "Webcams", 98700],
    ["Webcam C270", "Logitech", "Webcams", 42300],
    ["Webcam Brio 4K", "Logitech", "Webcams", 214000, 18000],
    ["Webcam con Aro de Luz", "Genérica", "Webcams", 37800],

    // Dos por categoría sin destacar: «Más categorías» muestra solo nombres.
    ["Adaptador USB-C a HDMI", "Genérica", "Adaptadores", 12400],
    ["Adaptador Jack 3,5 a USB", "Genérica", "Adaptadores", 6900],
    ["Alfombrilla Fury S", "HyperX", "Alfombrillas", 14300],
    ["Alfombrilla XL con Bordes", "HyperX", "Alfombrillas", 21700, 1700],
    ["Hub USB de 4 Puertos", "Genérica", "Hubs USB", 9800],
    ["Hub USB-C 7 en 1", "Genérica", "Hubs USB", 34500, 2500],
    ["Micrófono SoloCast", "HyperX", "Micrófonos", 78900],
    ["Micrófono QuadCast", "HyperX", "Micrófonos", 164000, 14000],
  ];

  return items.map(([nombre, marca, categoria, precio, descuento], i) => ({
    nombre,
    marca,
    categoria,
    precio,
    descuento,
    dias: 12 + i,
    variantes: [
      {
        color: i % 3 === 0 ? "Negro" : i % 3 === 1 ? "Blanco" : null,
        stock: [7, 15, 2, 30, 4][i % 5],
        fotos: 1,
      },
    ],
  }));
}

const slug = (s: string) =>
  PREFIJO +
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
    ["Negro", "#1c1e21"],
    ["Blanco", "#f4f5f6"],
    ["Rojo", "#8f2b2b"],
    ["Azul", "#26456e"],
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

/** Un logo inventado, horizontal como los de verdad. */
async function logoDePago(nombre: string, tono: number) {
  const matiz = (tono * 67) % 360;
  // Casi sin margen: en la home termina en una caja de 96×48.
  const ancho = 600;
  const alto = 200;
  const cuerpo = Math.min(
    64,
    Math.floor((ancho - 150) / (nombre.length * 0.52)),
  );
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
      <rect width="${ancho}" height="${alto}" rx="28" fill="#ffffff"/>
      <rect x="6" y="6" width="${ancho - 12}" height="${alto - 12}" rx="24"
            fill="hsl(${matiz} 55% 96%)" stroke="hsl(${matiz} 45% 72%)"
            stroke-width="3"/>
      <circle cx="82" cy="100" r="36" fill="hsl(${matiz} 62% 48%)"/>
      <text x="140" y="120" font-family="Helvetica, Arial, sans-serif"
            font-size="${cuerpo}" font-weight="700"
            fill="hsl(${matiz} 55% 30%)">${escapar(nombre)}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Solo los que falten por nombre, al final de la lista: no duplica ni
 * reordena los que alguien cargó desde el panel.
 */
async function sembrarMediosDePago() {
  let creados = 0;
  let logos = 0;

  for (const medio of MEDIOS_DE_PAGO) {
    const [existente] = await sql<{ id: string }[]>`
      SELECT id FROM payment_methods WHERE lower(name) = lower(${medio.nombre})`;
    if (existente) continue;

    const [fila] = await sql<{ id: string }[]>`
      INSERT INTO payment_methods (name, description, sort_order)
      VALUES (${medio.nombre}, ${MARCA_DE_DEMO},
              (SELECT coalesce(max(sort_order), -1) + 1 FROM payment_methods))
      RETURNING id`;
    creados++;

    if (medio.conLogo) {
      await publicarLogo({
        destino: "medio-de-pago",
        id: fila.id,
        archivo: await logoDePago(medio.nombre, creados + 2),
      });
      logos++;
    }
  }

  return { pagos: creados, logos };
}

const modo = process.argv[2] === "--limpiar" ? "limpiar" : "sembrar";

if (modo === "limpiar") {
  const b = await limpiar();
  console.log(
    `Borrados: ${b.productos} productos, ${b.marcas} marcas, ` +
      `${b.categorias} categorías, ${b.colores} colores, ` +
      `${b.pagos} medios de pago` +
      `${b.configuracion ? " y la configuración de demostración" : ""}.`,
  );
} else {
  const previos = await limpiar();
  if (previos.productos) {
    console.log(`Limpieza previa: ${previos.productos} productos.`);
  }
  const cuantos = await sembrar();
  const config = await sembrarConfiguracion();

  // En los dos sentidos: una categoría que dejó de estar destacada se apaga.
  await sql`
    UPDATE categories SET is_featured = true
     WHERE lower(name) = ANY(${CATEGORIAS.filter((c) => c.destacada).map((c) => c.nombre.toLowerCase())})`;
  await sql`
    UPDATE categories SET is_featured = false
     WHERE lower(name) = ANY(${CATEGORIAS.filter((c) => !c.destacada).map((c) => c.nombre.toLowerCase())})`;

  const pagos = await sembrarMediosDePago();

  const [{ n: fotos }] = await sql<
    { n: string }[]
  >`SELECT count(*)::text AS n FROM variant_images`;
  console.log(
    `Sembrados ${cuantos} productos con ${fotos} imágenes.\n` +
      (pagos.pagos
        ? `Medios de pago: ${pagos.pagos} nuevos, ${pagos.logos} con logo.\n`
        : `Medios de pago: ya estaban todos, no se tocó ninguno.\n`) +
      (config.configuracion
        ? `Configuración de demostración escrita: WhatsApp ${CONFIGURACION.whatsapp}.\n`
        : `Configuración: ya había una, no se tocó.\n`) +
      `Para verlos:  npm run dev  →  http://localhost:3000\n` +
      `Para borrarlos:  npm run seed:limpiar`,
  );
}

await sql.end();
