import { inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { brands, categories, products } from "@/db/schema";
import { procesarImagen } from "@/modules/media/procesar";
import {
  borrarImagenDeVariante,
  clavesDelLogo,
  publicarImagenDeVariante,
  publicarLogo,
  quitarLogo,
} from "@/modules/media/subir";
import { clave, TAMANOS, TAMANOS_LOGO } from "@/modules/media/tamanos";
import { rechazaLlamada } from "@/tests/apoyo/errores";
import { almacen, existe, jpeg } from "@/tests/apoyo/imagenes";

/**
 * F2.2 — la canalización de imágenes contra Storage de verdad. RF-17,
 * §9.1, §9.2, §9.4.
 *
 * Migrado de `scripts/verificar-imagenes.mts` (F4.0b).
 *
 * No prueba el Route Handler —eso necesita sesión de admin— sino las FUNCIONES
 * que lo sostienen, que es donde vive todo lo que puede salir mal: la
 * conversión, los tres tamaños, y sobre todo la limpieza cuando algo falla a
 * mitad. Un huérfano en Storage no lo encuentra nadie y no lo borra nadie:
 * ocupa lugar para siempre y no hay pantalla donde se note.
 */

describe("conversión (§9.2)", () => {
  let grande: Buffer;
  let procesada: Awaited<ReturnType<typeof procesarImagen>>;

  beforeAll(async () => {
    // Calidad 100 y ruido: el criterio de F2.2 habla de «un JPG de 8 MB», y
    // con un color plano de 3000×2000 el archivo pesaría 40 KB. La prueba
    // pasaría sin haber ejercitado nada de lo que pesa.
    grande = await jpeg(3000, 2000, 100);
    procesada = await procesarImagen(grande);
  });

  test("el JPG de entrada pesa varios MB de verdad", () => {
    expect(grande.byteLength).toBeGreaterThan(5 * 1024 * 1024);
  });

  test("salen exactamente tres versiones", () => {
    expect(procesada.versiones).toHaveLength(3);
  });

  test.each(TAMANOS.map((t) => [t.sufijo, t.ancho] as const))(
    "%s: es WEBP y mide %ipx de ancho",
    (sufijo, ancho) => {
      const v = procesada.versiones.find((x) => x.sufijo === sufijo)!;
      // «RIFF» son los cuatro primeros bytes de un WEBP. Mirar la extensión
      // no probaría nada: la pone quien guarda.
      expect(v.cuerpo.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(v.ancho).toBe(ancho);
    },
  );

  test("las tres pesan menos que el original", () => {
    expect(
      procesada.versiones.every((v) => v.bytes < grande.byteLength),
    ).toBe(true);
  });
});

describe("`withoutEnlargement` (§9.2)", () => {
  let anchoDe: (sufijo: string) => number;
  let medidas: { ancho: number; alto: number };

  beforeAll(async () => {
    const chico = await jpeg(300, 200, 100);
    const p = await procesarImagen(chico);
    anchoDe = (sufijo) => p.versiones.find((v) => v.sufijo === sufijo)!.ancho;
    medidas = { ancho: p.ancho, alto: p.alto };
  });

  test("una imagen de 300px sí se reduce a 200px en el thumb", () => {
    expect(anchoDe("thumb")).toBe(200);
  });

  test("pero no se agranda a 600 ni a 1400: se queda en 300px", () => {
    // Agrandar no agrega información: da un archivo más pesado y más borroso
    // que el original.
    expect(anchoDe("card")).toBe(300);
    expect(anchoDe("detail")).toBe(300);
  });

  test("las medidas registradas son las reales, no las nominales", () => {
    expect(medidas).toEqual({ ancho: 300, alto: 200 });
  });
});

describe("EXIF (§9.2, §16)", () => {
  /**
   * Orientación 6 = «rotar 90°»: una foto apaisada que hay que mostrar de pie.
   *
   * Se escribe con `withMetadata({orientation})` y NO con
   * `withExif({IFD0:{Orientation}})`. La segunda parece la obvia y no sirve:
   * deja el archivo en `orientation: 1`, y entonces el test pasaría siempre
   * porque no habría nada que rotar. Costó un fallo descubrirlo.
   */
  const rotada = () =>
    sharp({
      create: { width: 400, height: 200, channels: 3, background: "#832833" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

  const conExif = () =>
    sharp({
      create: { width: 400, height: 200, channels: 3, background: "#832833" },
    })
      .withExif({ IFD0: { Make: "AnaVende Test", Model: "XT-500" } })
      .jpeg()
      .toBuffer();

  test("el archivo de prueba realmente lleva orientación 6", async () => {
    expect((await sharp(await rotada()).metadata()).orientation).toBe(6);
  });

  test("una foto con orientación EXIF sale derecha (400×200 → 200×400)", async () => {
    const orientada = await procesarImagen(await rotada());
    expect({ ancho: orientada.ancho, alto: orientada.alto }).toEqual({
      ancho: 200,
      alto: 400,
    });
  });

  test("el de prueba entra con EXIF", async () => {
    expect((await sharp(await conExif()).metadata()).exif).toBeDefined();
  });

  /**
   * Lo que no es orientación no sobrevive. Ahí viven la marca y el modelo del
   * teléfono y, en una foto sacada de verdad, las COORDENADAS de dónde se
   * sacó: publicar el catálogo publicaría la casa de Ana (§16).
   */
  test("el resto del EXIF no viaja: no queda marca ni modelo del equipo", async () => {
    const procesada = await procesarImagen(await conExif());
    const detail = procesada.versiones.find((v) => v.sufijo === "detail")!;
    expect((await sharp(detail.cuerpo).metadata()).exif).toBeFalsy();
  });
});

describe("lo que no se acepta (§9.1, RF-17)", () => {
  test("un archivo vacío", async () => {
    await rechazaLlamada(() => procesarImagen(Buffer.alloc(0)));
  });

  test("un HTML disfrazado de .jpg", async () => {
    await rechazaLlamada(() =>
      procesarImagen(Buffer.from("<html><script>alert(1)</script></html>")),
    );
  });

  test("un GIF, que no está entre los formatos aceptados", async () => {
    await rechazaLlamada(() =>
      procesarImagen(Buffer.from("GIF89a" + " ".repeat(64), "binary")),
    );
  });

  test("un JPG con la firma correcta y el contenido roto", async () => {
    // La firma es lo único que mira quien confía en la extensión. Acá se
    // decodifica de verdad, así que un archivo que empieza bien y sigue mal
    // no pasa.
    await rechazaLlamada(() =>
      procesarImagen(
        Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(500)]),
      ),
    );
  });

  test("un archivo de más de 10 MB", async () => {
    await rechazaLlamada(() =>
      procesarImagen(
        Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.alloc(11 * 1024 * 1024),
        ]),
      ),
    );
  });
});

describe("publicación y limpieza (§9.1, §9.4)", () => {
  const marca = String(Date.now());
  const productosDePrueba: string[] = [];

  let marcaId = "";
  let categoriaId = "";
  let producto = "";
  let variante = "";
  let grande: Buffer;
  let extra: Buffer;
  let publicada: Awaited<ReturnType<typeof publicarImagenDeVariante>>;

  async function unaFila(consulta: ReturnType<typeof sql>) {
    const [f] = await db.execute<{ id: string }>(consulta);
    return f.id;
  }

  beforeAll(async () => {
    grande = await jpeg(3000, 2000, 100);
    extra = await jpeg(800, 600, 100);

    marcaId = await unaFila(sql`
      INSERT INTO brands (name, slug)
      VALUES ('Prueba Imagen', ${`prueba-imagen-${marca}`}) RETURNING id`);
    categoriaId = await unaFila(sql`
      INSERT INTO categories (name, slug)
      VALUES ('Prueba Imagen', ${`prueba-imagen-cat-${marca}`}) RETURNING id`);
    producto = await unaFila(sql`
      INSERT INTO products (name, slug, brand_id, category_id, price)
      VALUES ('Producto de prueba', ${`producto-prueba-${marca}`},
              ${marcaId}, ${categoriaId}, 1000) RETURNING id`);
    productosDePrueba.push(producto);

    variante = await unaFila(sql`
      INSERT INTO product_variants (product_id) VALUES (${producto}) RETURNING id`);
  });

  afterAll(async () => {
    const restantes = await db.execute<{ id: string }>(sql`
      SELECT i.id FROM variant_images i
        JOIN product_variants v ON v.id = i.variant_id
       WHERE v.product_id = ANY(ARRAY[${sql.join(
         productosDePrueba.map((id) => sql`${id}::uuid`),
         sql`, `,
       )}])`);
    for (const r of restantes) {
      await borrarImagenDeVariante(r.id).catch(() => {});
    }

    await db.delete(products).where(inArray(products.id, productosDePrueba));
    await db.delete(brands).where(inArray(brands.id, [marcaId]));
    await db.delete(categories).where(inArray(categories.id, [categoriaId]));
  });

  describe("de punta a punta", () => {
    test("los tres WEBP están en Storage y se leen por HTTPS", async () => {
      publicada = await publicarImagenDeVariante({
        productId: producto,
        variantId: variante,
        archivo: grande,
        altText: "Imagen de prueba",
      });

      const presentes = await Promise.all(
        TAMANOS.map(({ sufijo }) => existe(clave(publicada.storageKey, sufijo))),
      );
      expect(presentes).toEqual(TAMANOS.map(() => true));
    });

    test("queda la fila, con la clave base y en la posición 0", async () => {
      const [fila] = await db.execute<{
        storageKey: string;
        sortOrder: number;
      }>(sql`
        SELECT storage_key AS "storageKey", sort_order AS "sortOrder"
          FROM variant_images WHERE id = ${publicada.id}`);

      expect(fila).toBeDefined();
      // Sin sufijo ni extensión: la fila nombra las TRES versiones a la vez
      // (§9.2). Guardar «…-card.webp» ataría la fila a un tamaño.
      expect(fila.storageKey).toBe(publicada.storageKey);
      expect(fila.storageKey.endsWith(".webp")).toBe(false);
      expect(fila.sortOrder).toBe(0);
    });

    test("la sexta imagen de una variante se rechaza (RF-17)", async () => {
      for (let i = 1; i < 5; i++) {
        await publicarImagenDeVariante({
          productId: producto,
          variantId: variante,
          archivo: extra,
        });
      }

      await rechazaLlamada(() =>
        publicarImagenDeVariante({
          productId: producto,
          variantId: variante,
          archivo: extra,
        }),
      );
    });
  });

  /**
   * R3 del plan: qué queda cuando Storage falla a mitad. La respuesta correcta
   * no es «casi nada»: es NADA. Ni archivos ni fila.
   *
   * La variante vacía va en OTRO producto a propósito:
   * `variant_product_color_key` impide dos variantes sin color en el mismo
   * producto, y reusar la anterior —que ya tiene sus cinco— haría fallar la
   * prueba por el tope y no por lo que se quiere probar. Ya pasó una vez.
   */
  describe("sin huérfanos cuando falla a mitad", () => {
    test("una subida cortada en el tercer tamaño no deja nada", async () => {
      const producto2 = await unaFila(sql`
        INSERT INTO products (name, slug, brand_id, category_id, price)
        VALUES ('Producto de prueba 2', ${`producto-prueba2-${marca}`},
                ${marcaId}, ${categoriaId}, 1000) RETURNING id`);
      productosDePrueba.push(producto2);

      const vacia = await unaFila(sql`
        INSERT INTO product_variants (product_id) VALUES (${producto2}) RETURNING id`);

      const [{ n: antes }] = await db.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM variant_images`,
      );

      const real = almacen.put.bind(almacen);
      const subidos: string[] = [];
      let llamadas = 0;
      almacen.put = async (key, body, tipo) => {
        if (++llamadas === 3) throw new Error("Storage caído a propósito");
        await real(key, body, tipo);
        subidos.push(key);
      };

      try {
        await rechazaLlamada(() =>
          publicarImagenDeVariante({
            productId: producto2,
            variantId: vacia,
            archivo: extra,
          }),
        );
      } finally {
        almacen.put = real;
      }

      expect(subidos).toHaveLength(2);

      // Los dos que SÍ habían subido tienen que haberse borrado solos.
      expect(await Promise.all(subidos.map(existe))).toEqual([false, false]);

      const [{ n: despues }] = await db.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM variant_images`,
      );
      expect(despues).toBe(antes);
    });
  });

  describe("el logo de marca (RF-18)", () => {
    let logoKey = "";
    let segundo = "";
    let delLogo: string[] = [];
    let delSegundo: string[] = [];

    test("genera DOS tamaños, no tres, y no genera `-detail`", async () => {
      ({ logoKey } = await publicarLogo({
        destino: "marca",
        id: marcaId,
        archivo: await jpeg(900, 300, 100),
      }));
      delLogo = TAMANOS_LOGO.map((t) => clave(logoKey, t.sufijo));

      expect(delLogo).toHaveLength(2);
      // Un logo no tiene dónde usar 1400px: sería un archivo por marca que
      // nadie pide nunca.
      expect(await existe(clave(logoKey, "detail"))).toBe(false);
      expect(await Promise.all(delLogo.map(existe))).toEqual([true, true]);
    });

    test("`brands.logo_key` guarda la clave, no la URL", async () => {
      const [f] = await db.execute<{ logoKey: string }>(
        sql`SELECT logo_key AS "logoKey" FROM brands WHERE id = ${marcaId}`,
      );
      expect(f.logoKey).toBe(logoKey);
      expect(f.logoKey.startsWith("http")).toBe(false);
    });

    /**
     * Lo que más fácil se olvida: sin esto, cada corrección de logo deja un
     * juego de archivos que nadie muestra y nadie encuentra.
     */
    test("reemplazar genera una clave nueva y borra los archivos del anterior", async () => {
      ({ logoKey: segundo } = await publicarLogo({
        destino: "marca",
        id: marcaId,
        archivo: await jpeg(600, 600, 100),
      }));
      delSegundo = TAMANOS_LOGO.map((t) => clave(segundo, t.sufijo));

      expect(segundo).not.toBe(logoKey);
      expect(await Promise.all(delLogo.map(existe))).toEqual([false, false]);
      expect(await Promise.all(delSegundo.map(existe))).toEqual([true, true]);
    });

    test("`clavesDelLogo` devuelve lo que hay que borrar al borrar la marca", async () => {
      expect(await clavesDelLogo("marca", marcaId)).toHaveLength(2);
    });

    test("quitar el logo borra los archivos, no solo la referencia", async () => {
      await quitarLogo("marca", marcaId);

      expect(await Promise.all(delSegundo.map(existe))).toEqual([false, false]);

      const [f] = await db.execute<{ logoKey: string | null }>(
        sql`SELECT logo_key AS "logoKey" FROM brands WHERE id = ${marcaId}`,
      );
      expect(f.logoKey).toBeNull();
    });

    test("una marca sin logo no tiene nada que borrar", async () => {
      expect(await clavesDelLogo("marca", marcaId)).toHaveLength(0);
    });
  });

  describe("borrar quita los archivos, no solo la fila (RF-17)", () => {
    test("borrar la imagen la saca también de Storage, y saca la fila", async () => {
      const claves = TAMANOS.map(({ sufijo }) =>
        clave(publicada.storageKey, sufijo),
      );

      await borrarImagenDeVariante(publicada.id);

      expect(await Promise.all(claves.map(existe))).toEqual([
        false,
        false,
        false,
      ]);

      const quedan = await db.execute(
        sql`SELECT id FROM variant_images WHERE id = ${publicada.id}`,
      );
      expect(quedan).toHaveLength(0);
    });
  });
});
