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
 * F3.5 y F3.6 — RF-03, RF-04, RN-05, §9.5.
 *
 * Lo que se prueba es lo que no se ve leyendo el componente: la consulta de
 * la ficha tiene un LATERAL con un agregado adentro de otro, y tres reglas
 * viven ahí y en ningún otro lado —el orden de los colores, el respaldo de
 * imágenes de §9.5 y la exclusión de variantes desactivadas—. Las tres son
 * silenciosas: cuando fallan no hay error, hay una ficha que muestra el
 * color equivocado o una galería vacía.
 *
 * Los mensajes de WhatsApp se prueban acá y no aparte porque son la otra
 * mitad de la misma pantalla, y porque su criterio de RF-04 —«bien
 * codificado: acentos, saltos de línea, el `$`»— es exactamente la clase de
 * cosa que se rompe sin que nadie lo note hasta que un cliente recibe un
 * mensaje cortado.
 */

const creados: string[] = [];

/**
 * Un color propio por test.
 *
 * El NOMBRE lleva sufijo, no solo el slug: `colors_name_key` es único por
 * `lower(name)`, así que un test que insertara «Negro» chocaría con el que ya
 * cargó el seed —o con el que cargó Ana— y fallaría por el entorno y no por
 * lo que prueba. El sufijo va al final para que el orden alfabético de los
 * nombres siga siendo el del prefijo, que es lo que un test de acá compara.
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
 * Una fila de `variant_images` sin subir nada a Storage.
 *
 * La consulta solo lee `storage_key` y `alt_text`, y armar la URL es
 * concatenar (§9.4). Subir archivos de verdad probaría `publicarImagenDeVariante`,
 * que ya tiene sus tests en F2.4, y volvería lento un test que no habla de eso.
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
   * RN-05: un producto inactivo NO es visible en el sitio público. Devuelve
   * lo mismo que uno inexistente a propósito — distinguirlos contaría que
   * existe, que es justo lo que la baja quiso ocultar.
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
   * El orden del selector de color. Con `sort_order` empatado desempata el
   * nombre, y eso NO es un detalle: sin desempate el orden lo decide el UUID
   * de la variante, así que el color que se abre por omisión cambiaba entre
   * dos cargas de la misma pantalla — y la tarjeta del catálogo, que usa el
   * mismo orden, podía mostrar otro.
   */
  test("las variantes salen por sort_order y el nombre desempata", async () => {
    const productId = await unProducto();
    const rojo = await unColor("Rojo", "#8f2b2b");
    const azul = await unColor("Azul", "#26456e");
    const verde = await unColor("Verde", "#2b8f4b");

    // Se insertan a propósito en desorden y con dos empatados en 0.
    await unaVarianteDe(productId, { colorId: verde.id, orden: 1 });
    await unaVarianteDe(productId, { colorId: rojo.id, orden: 0 });
    await unaVarianteDe(productId, { colorId: azul.id, orden: 0 });

    const ficha = await leerFicha(await slugDe(productId));

    // Azul y Rojo empatan en sort_order 0 y los ordena el nombre; Verde va
    // último porque su sort_order es 1, aunque alfabéticamente iría ahí igual.
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
   * §9.5 y RF-16: una variante puede mostrar las fotos de otra. Sin el
   * `coalesce(images_source_id, id)` la que reutiliza sale con la galería
   * vacía, que es un estado que existe de verdad —una variante recién creada
   * no tiene fotos— y por eso no se distingue de un error mirando la pantalla.
   */
  test("una variante que reutiliza imágenes muestra las de su fuente", async () => {
    const productId = await unProducto();
    const negro = await unColor("Negro");
    const gris = await unColor("Gris", "#8a8a8a");

    const fuente = await unaVarianteDe(productId, { colorId: negro.id, orden: 0 });
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
    // Las mismas URLs, no unas parecidas: es la misma foto servida dos veces.
    expect(reutiliza.imagenes.map((i) => i.grande)).toEqual(
      conFotos.imagenes.map((i) => i.grande),
    );
    // Y son dos tamaños distintos del MISMO archivo (§9.2).
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
   * RF-24 permite stock NEGATIVO —una venta cargada sobre unidades que el
   * sistema no tenía—. La consulta lo devuelve tal cual y es la vista la que
   * lo lleva a cero: si lo acotara acá, el panel y la tienda leerían números
   * distintos de la misma fila.
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
    { colorSlug: "negro", colorNombre: "Negro", colorHex: "#000", disponible: 1, imagenes: [] },
    { colorSlug: "blanco", colorNombre: "Blanco", colorHex: "#fff", disponible: 1, imagenes: [] },
  ];

  test("sin parámetro abre en la primera", () => {
    expect(varianteInicial(variantes, undefined)).toBe(0);
  });

  test("con un color válido abre en ese", () => {
    expect(varianteInicial(variantes, "blanco")).toBe(1);
  });

  /**
   * Un color que ya no existe NO es un 404: el producto sigue estando y es lo
   * que la persona fue a ver. Castigar un enlace viejo con una página de
   * error es perder una visita por un parámetro de consulta.
   */
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

  /**
   * El criterio literal de RF-04. Los tres viajan escapados: sin eso el `$`
   * corta el texto en algunos clientes y los saltos de línea se pierden, y el
   * mensaje llega como un renglón corrido que la vendedora tiene que
   * descifrar.
   */
  test("acentos, saltos de línea y el $ viajan escapados", () => {
    const enlace = enlaceDeWhatsApp(
      "+5491122334455",
      mensajeDeCompra(producto, 1, "$ 24.500,00"),
    );

    expect(enlace).toContain("%0A"); // salto de línea
    expect(enlace).toContain("%24"); // el signo peso
    expect(enlace).toContain("%C3%A1"); // la á de «Mecánico»
    expect(enlace).not.toContain("\n");

    // Y vuelve entero del otro lado.
    const texto = decodeURIComponent(new URL(enlace).searchParams.get("text")!);
    expect(texto).toContain("Teclado Mecánico K120");
    expect(texto.split("\n").length).toBeGreaterThan(3);
  });

  /**
   * `wa.me` quiere dígitos y nada más. El número se guarda normalizado a
   * `+549…` (RF-20, `lib/telefono.ts`), pero limpiarlo acá es lo que hace que
   * una fila escrita a mano con guiones no rompa el enlace en silencio.
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
