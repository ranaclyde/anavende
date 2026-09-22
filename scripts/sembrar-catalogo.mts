/**
 * Catálogo de demostración para construir F3 — 26 productos, más el número
 * de WhatsApp sin el cual la ficha no tiene acción.
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
 * **También siembra el número de WhatsApp, y esa parte es de F3.6.** Sin él
 * la ficha se dibuja sin su acción principal, que es como no verla: la carga
 * la vendedora (F2.7) y en una base recién levantada no existe. Se escribe
 * SOLO si no hay fila, y `--limpiar` se la lleva SOLO si sigue siendo la del
 * seed — en cuanto alguien la editó desde el panel es suya. Los tests de
 * configuración BORRAN esa fila, así que después de `npm test` hay que
 * volver a sembrar; es la misma convivencia que ya tiene el catálogo, y el
 * arreglo de fondo es separar las dos bases.
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
const { clavesDeProducto, clavesDelLogo, publicarLogo, borrarArchivos } =
  await import("../modules/media/subir.ts");

const sql = postgres(baseUrl, { max: 1 });

/** Todo lo que siembra este script lleva este prefijo en el slug. */
const PREFIJO = "demo-";

/** El residuo de los tests: `Producto <8 hex>`, `Marca …`, `Rubro …`. */
const RESIDUO = "^(producto|marca|rubro)-[0-9a-f]{8}$";

/**
 * La configuración mínima para que la tienda se pueda MIRAR entera.
 *
 * Sin el número de WhatsApp no se dibuja ni un botón de F3.6 —la ficha se ve
 * sin su acción principal, que es como no verla— y sin medios de pago falta
 * el bloque de RF-03. Las dos cosas las carga la vendedora en F2.7 y F2.6, y
 * en una base recién levantada no existen: `site_settings` no la escribe
 * ninguna migración (§5.9).
 *
 * El número es evidentemente falso a propósito: si algún día esto corriera
 * donde no debe, se nota en el acto en vez de mandar mensajes a alguien.
 *
 * **Los medios de pago SÍ se siembran desde el 2026-09-22**, y hasta ese día
 * no: el listado de RF-19 se ordena globalmente, y `pagos.test.ts` movía sus
 * tres filas contando desde el principio de la tabla, así que con filas
 * sembradas encima «subir el primero no cambia nada» cambiaba algo. **Eso ya
 * está arreglado en el test**, que toma el primero DE LA TABLA y compara con
 * `endsWith` justamente porque la base local puede tener medios cargados de
 * antes. Se siembran ahora porque la home dibuja su hilera y sólo con los que
 * tienen logo (§7.1): sin filas con imagen, esa franja no se puede mirar.
 */
const CONFIGURACION = {
  whatsapp: "+5491100000000",
  email: "demo@anavende.invalid",
};

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
    configuracion: 0,
    pagos: 0,
  };

  // Los medios de pago que siguen siendo los del seed. Los archivos primero,
  // por lo mismo que las fotos: después del DELETE la clave se perdió con la
  // fila y los tres tamaños quedan en el bucket sin nada que los nombre.
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

  // La configuración de demostración se borra SOLO si sigue siendo la que
  // escribió el seed. En cuanto alguien la editó desde el panel es suya, y
  // llevársela sería apagarle la tienda por correr una limpieza de catálogo.
  borrados.configuracion = (
    await sql`DELETE FROM site_settings
               WHERE id = 1
                 AND whatsapp_number = ${CONFIGURACION.whatsapp}
                 AND admin_notification_email = ${CONFIGURACION.email}
               RETURNING id`
  ).length;

  return borrados;
}

/**
 * La configuración, solo si no hay. Nunca pisa lo que ya está: quien guardó
 * la pantalla de configuración eligió ese número, y volver a sembrar no
 * puede deshacerlo.
 */
async function sembrarConfiguracion() {
  const [fila] = await sql<{ id: number }[]>`
    INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
    VALUES (1, ${CONFIGURACION.whatsapp}, ${CONFIGURACION.email})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`;

  return { configuracion: Boolean(fila) };
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

/**
 * Las categorías del catálogo de demostración, y cuáles están **destacadas**.
 *
 * Importa desde el 2026-09-22, porque la home las usa de tres formas (§7.1):
 * las destacadas son los chips de arriba —**con tope de siete**— y son las que
 * tienen sección propia con producto adentro; las demás llenan la sección de
 * «Más categorías» de abajo.
 *
 * **Son ocho destacadas a propósito, no siete**: ordenadas por nombre, la que
 * queda afuera es «Webcams», y sin una octava el tope no se puede ver
 * funcionar. Y hay cuatro sin destacar para que la sección de abajo tenga qué
 * mostrar.
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
 * Los medios de pago de RF-19, que hasta el 2026-09-22 no se sembraban.
 *
 * Ahora sí, porque la home dibuja su hilera y **sólo con los que tienen logo**
 * (§7.1): sin filas con imagen, esa franja no se puede mirar. «Efectivo» va a
 * propósito **sin logo**, que es el caso que la hilera tiene que saber dejar
 * afuera sin dejar un hueco.
 *
 * Los logos son inventados —una píldora con el nombre escrito—, como las fotos
 * de los productos: pasan por la misma canalización de §9.4, así que lo que se
 * mira son los pesos y las proporciones que va a tener.
 *
 * **La marca de que son del seed es la descripción**, igual que el número de
 * WhatsApp: `--limpiar` se lleva sólo las filas que siguen diciendo lo que el
 * seed escribió. En cuanto alguien las editó desde el panel (F2.6) son suyas.
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
    // SIN FOTOS: el estado que nadie prueba y siempre aparece.
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
    // Nombre con acento: «mecanico» tiene que encontrarlo (F3.3).
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
    // INACTIVO: no tiene que aparecer en la tienda, y la ficha da 404 (F3.5).
    nombre: "Mouse Cobra Pro",
    marca: "Redragon",
    categoria: "Mouses",
    precio: 34900,
    activo: false,
    dias: 8,
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

    // ── Las cuatro categorías destacadas que se sumaron el 2026-09-22 ──
    // Cuatro productos cada una: la home dibuja **una fila** por sección
    // (§7.1), y la grilla de escritorio es de cuatro. Con tres, la sección se
    // ve a medio llenar en el único ancho donde más se la mira.
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

    // ── Las cuatro SIN destacar: son las de «Más categorías» ──
    // Dos cada una, que es suficiente para que la categoría exista de verdad
    // —el chip del catálogo, el filtro, la ficha— sin sumar tiempo de seed
    // para una sección que muestra nombres y no productos.
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

// ─────────────────────────────────────────────────────────────────────────

const slug = (s: string) =>
  PREFIJO +
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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

/**
 * El logo inventado de un medio de pago: una píldora con el nombre.
 *
 * Horizontal y no cuadrado, porque es la forma que tiene un logo de medio de
 * pago de verdad y es lo que la hilera de la home tiene que saber acomodar.
 */
async function logoDePago(nombre: string, tono: number) {
  const matiz = (tono * 67) % 360;
  // El dibujo ocupa casi todo el lienzo: el logo termina dentro de una caja
  // de 96×48 en la home, y con márgenes generosos el nombre llegaba ahí
  // ilegible. Los de verdad —los que cargó la vendedora— no tienen aire de
  // sobra tampoco.
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
 * Los medios de pago, **sólo los que falten por nombre**.
 *
 * No «si la tabla está vacía»: la base local ya tenía tres cargados a mano
 * desde el panel (F2.6), con sus logos de verdad, y un seed que se saltea
 * entero por eso dejaría la hilera de la home con tres piezas. No «todos»:
 * volver a sembrar duplicaría los de alguien. Lo que falta, entonces, y cada
 * uno al final de la lista — el orden lo acomoda la vendedora, que es de quien
 * es esa decisión (RF-19).
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

// ─────────────────────────────────────────────────────────────────────────

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

  // La bandera se escribe desde `CATEGORIAS` y en los dos sentidos: sembrar
  // dos veces con una categoría que dejó de estar destacada tiene que
  // apagarla, o la home seguiría dibujando una sección que ya no va.
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
