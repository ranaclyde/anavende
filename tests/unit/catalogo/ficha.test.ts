import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  enlaceDeWhatsApp,
  mensajeDeCompra,
  mensajeDeDisponibilidad,
} from "@/lib/whatsapp";
import { leerFicha, varianteInicial } from "@/modules/catalog/products/ficha";
import { limpiar, unProducto } from "@/tests/apoyo/catalogo";

/**
 * La consulta de la ficha guarda tres reglas que fallan en silencio: el orden
 * de los colores, el respaldo de imágenes (§9.5) y la exclusión de variantes
 * desactivadas. Los mensajes de WhatsApp van acá porque son la otra mitad de
 * la pantalla.
 */
const creados: string[] = [];

/**
 * El nombre lleva sufijo, no solo el slug: `colors_name_key` es único por
 * `lower(name)` y chocaría con los colores del seed. Va al final para que el
 * orden alfabético siga siendo el del prefijo.
 */
async function unColor(
  nombre: string,
  hex = "#1c1e21",
): Promise<{ id: string; nombre: string }> {
  const sufijo = randomUUID().slice(0, 8);
  const completo = `${nombre} ${sufijo}`;
  const [color] = await db.execute<{ id: string }>(sql`
    INSERT INTO colors (name, slug, hex_code)
    VALUES (${completo}, ${`${nombre.toLowerCase()}-${sufijo}`}, ${hex})
    RETURNING id`);
  creados.push(color.id);
  return { id: color.id, nombre: completo };
}

async function unaVarianteDe(
  productId: string,
  v: {
    colorId?: string | null;
    stock?: number;
    reservado?: number;
    orden?: number;
    activa?: boolean;
    imagesSourceId?: string | null;
  } = {},
): Promise<string> {
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO product_variants
      (product_id, color_id, stock_total, reserved_stock, sort_order,
       is_active, images_source_id)
    VALUES (${productId}, ${v.colorId ?? null}, ${v.stock ?? 0},
            ${v.reservado ?? 0}, ${v.orden ?? 0}, ${v.activa ?? true},
            ${v.imagesSourceId ?? null})
    RETURNING id`);
  return fila.id;
}

/**
 * Una fila de `variant_images` sin subir nada a Storage: la consulta solo lee
 * `storage_key` y `alt_text`.
 */
async function unaImagen(
  variantId: string,
  key: string,
  orden = 0,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO variant_images (variant_id, storage_key, alt_text, width, height, bytes, sort_order)
    VALUES (${variantId}, ${key}, ${null}, 600, 600, 1000, ${orden})`);
}

async function slugDe(productId: string): Promise<string> {
  const [fila] = await db.execute<{ slug: string }>(
    sql`SELECT slug FROM products WHERE id = ${productId}`,
  );
  return fila.slug;
}

afterAll(async () => {
  await limpiar();
  for (const id of creados.splice(0)) {
    await db.execute(sql`DELETE FROM colors WHERE id = ${id}`);
  }
});

describe("leerFicha (RF-03)", () => {
  test("un slug que no existe devuelve null, no una excepción", async () => {
    expect(await leerFicha("no-existe-este-producto")).toBeNull();
  });

  /**
   * RN-05. Igual que uno inexistente a propósito: distinguirlos contaría que
   * existe, que es lo que la baja quiso ocultar.
   */
  test("un producto desactivado devuelve null, igual que uno inexistente", async () => {
    const productId = await unProducto();
    const slug = await slugDe(productId);

    expect(await leerFicha(slug)).not.toBeNull();

    await db.execute(
      sql`UPDATE products SET is_active = false WHERE id = ${productId}`,
    );

    expect(await leerFicha(slug)).toBeNull();
  });

  /**
   * Sin desempate el orden lo decide el UUID de la variante, y el color que
   * se abre por omisión cambia entre dos cargas de la misma pantalla.
   */
  test("las variantes salen por sort_order y el nombre desempata", async () => {
    const productId = await unProducto();
    const rojo = await unColor("Rojo", "#8f2b2b");
    const azul = await unColor("Azul", "#26456e");
    const verde = await unColor("Verde", "#2b8f4b");

    // A propósito en desorden y con dos empatados en 0.
    await unaVarianteDe(productId, { colorId: verde.id, orden: 1 });
    await unaVarianteDe(productId, { colorId: rojo.id, orden: 0 });
    await unaVarianteDe(productId, { colorId: azul.id, orden: 0 });

    const ficha = await leerFicha(await slugDe(productId));

    expect(ficha?.variantes.map((v) => v.colorNombre)).toEqual([
      azul.nombre,
      rojo.nombre,
      verde.nombre,
    ]);
  });

  test("una variante desactivada no aparece en la ficha", async () => {
    const productId = await unProducto();
    const negro = await unColor("Negro");
    const blanco = await unColor("Blanco", "#f4f5f6");

    await unaVarianteDe(productId, { colorId: negro.id });
    await unaVarianteDe(productId, { colorId: blanco.id, activa: false });

    const ficha = await leerFicha(await slugDe(productId));

    expect(ficha?.variantes).toHaveLength(1);
    expect(ficha?.variantes[0].colorNombre).toBe(negro.nombre);
  });

  /**
   * §9.5: sin el `coalesce(images_source_id, id)` la que reutiliza sale con la
   * galería vacía, que es un estado real y no se distingue de un error.
   */
  test("una variante que reutiliza imágenes muestra las de su fuente", async () => {
    const productId = await unProducto();
    const negro = await unColor("Negro");
    const gris = await unColor("Gris", "#8a8a8a");

    const fuente = await unaVarianteDe(productId, {
      colorId: negro.id,
      orden: 0,
    });
    await unaImagen(fuente, "productos/x/fuente/1", 0);
    await unaImagen(fuente, "productos/x/fuente/2", 1);

    await unaVarianteDe(productId, {
      colorId: gris.id,
      orden: 1,
      imagesSourceId: fuente,
    });

    const ficha = await leerFicha(await slugDe(productId));
    const [conFotos, reutiliza] = ficha!.variantes;

    expect(conFotos.imagenes).toHaveLength(2);
    expect(reutiliza.imagenes).toHaveLength(2);
    expect(reutiliza.imagenes.map((i) => i.grande)).toEqual(
      conFotos.imagenes.map((i) => i.grande),
    );
    // Dos tamaños del mismo archivo (§9.2).
    expect(conFotos.imagenes[0].grande).toContain("detail");
    expect(conFotos.imagenes[0].miniatura).toContain("thumb");
  });

  test("las imágenes salen en el orden en que la vendedora las dejó", async () => {
    const productId = await unProducto();
    const variante = await unaVarianteDe(productId);

    await unaImagen(variante, "productos/x/v/tercera", 2);
    await unaImagen(variante, "productos/x/v/primera", 0);
    await unaImagen(variante, "productos/x/v/segunda", 1);

    const ficha = await leerFicha(await slugDe(productId));

    expect(
      ficha?.variantes[0].imagenes.map((i) =>
        i.grande.includes("primera")
          ? "primera"
          : i.grande.includes("segunda")
            ? "segunda"
            : "tercera",
      ),
    ).toEqual(["primera", "segunda", "tercera"]);
  });

  /**
   * RF-24 permite stock negativo. La vista lo lleva a cero, no la consulta:
   * si lo acotara acá, el panel y la tienda leerían números distintos.
   */
  test("el disponible llega crudo, negativo incluido", async () => {
    const productId = await unProducto();
    await unaVarianteDe(productId, { stock: -3 });

    const ficha = await leerFicha(await slugDe(productId));

    expect(ficha?.variantes[0].disponible).toBe(-3);
  });

  test("lo reservado no está disponible (§8.1)", async () => {
    const productId = await unProducto();
    await unaVarianteDe(productId, { stock: 10, reservado: 4 });

    const ficha = await leerFicha(await slugDe(productId));

    expect(ficha?.variantes[0].disponible).toBe(6);
  });

  test("un producto sin ninguna variante devuelve la lista vacía, no null", async () => {
    const productId = await unProducto();

    const ficha = await leerFicha(await slugDe(productId));

    expect(ficha).not.toBeNull();
    expect(ficha?.variantes).toEqual([]);
  });
});

describe("varianteInicial (?color= de RF-03)", () => {
  const variantes = [
    {
      id: "v-negro",
      colorSlug: "negro",
      colorNombre: "Negro",
      colorHex: "#000",
      colorHex2: null,
      disponible: 1,
      imagenes: [],
    },
    {
      id: "v-blanco",
      colorSlug: "blanco",
      colorNombre: "Blanco",
      colorHex: "#fff",
      colorHex2: null,
      disponible: 1,
      imagenes: [],
    },
  ];

  test("sin parámetro abre en la primera", () => {
    expect(varianteInicial(variantes, undefined)).toBe(0);
  });

  test("con un color válido abre en ese", () => {
    expect(varianteInicial(variantes, "blanco")).toBe(1);
  });

  /** Un enlace viejo no merece un 404: el producto sigue estando. */
  test("un color que no existe cae en la primera, no falla", () => {
    expect(varianteInicial(variantes, "fucsia")).toBe(0);
  });

  test("sin variantes devuelve -1, que es un estado real", () => {
    expect(varianteInicial([], "negro")).toBe(-1);
  });
});

describe("enlaces de WhatsApp (RF-04, RF-03)", () => {
  const producto = {
    nombre: "Teclado Mecánico K120",
    marca: "Logitech",
    color: "Negro",
    url: "https://anavende.test/productos/teclado-k120?color=negro",
  };

  test("el mensaje de compra lleva cantidad y precio; el de disponibilidad, ninguno", () => {
    const compra = mensajeDeCompra(producto, 2, "$ 24.500,00");
    expect(compra).toContain("Cantidad: 2");
    expect(compra).toContain("$ 24.500,00");
    expect(compra).toContain(producto.url);

    const consulta = mensajeDeDisponibilidad(producto);
    expect(consulta).not.toContain("Cantidad");
    expect(consulta).not.toContain("24.500");
    expect(consulta).toContain("Teclado Mecánico K120 (Logitech)");
    expect(consulta).toContain("Color: negro");
  });

  test("un producto sin color no escribe el renglón del color", () => {
    const sinColor = { ...producto, color: null };
    expect(mensajeDeDisponibilidad(sinColor)).not.toContain("Color:");
  });

  /** Sin escapar, el `$` corta el texto en algunos clientes y los saltos de línea se pierden. */
  test("acentos, saltos de línea y el $ viajan escapados", () => {
    const enlace = enlaceDeWhatsApp(
      "+5491122334455",
      mensajeDeCompra(producto, 1, "$ 24.500,00"),
    );

    expect(enlace).toContain("%0A"); // salto de línea
    expect(enlace).toContain("%24"); // el signo peso
    expect(enlace).toContain("%C3%A1"); // la á de «Mecánico»
    expect(enlace).not.toContain("\n");

    const texto = decodeURIComponent(new URL(enlace).searchParams.get("text")!);
    expect(texto).toContain("Teclado Mecánico K120");
    expect(texto.split("\n").length).toBeGreaterThan(3);
  });

  /**
   * `wa.me` quiere solo dígitos. El número se guarda normalizado, pero una
   * fila escrita a mano con guiones rompería el enlace en silencio.
   */
  test("el número se limpia: sin +, sin espacios, sin guiones", () => {
    const esperado = "https://wa.me/5491122334455";
    for (const numero of [
      "+5491122334455",
      "+54 9 11 2233-4455",
      "5491122334455",
    ]) {
      expect(enlaceDeWhatsApp(numero, "hola").startsWith(esperado)).toBe(true);
    }
  });
});
