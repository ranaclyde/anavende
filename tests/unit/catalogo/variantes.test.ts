import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { brands, categories, colors, products } from "@/db/schema";
import {
  crearVariante,
  ordenDeImagenes,
} from "@/modules/catalog/variants/schemas";
import {
  borrarArchivos,
  borrarImagenDeVariante,
  clavesDeProducto,
  clavesDeVariante,
  publicarImagenDeVariante,
  reordenarImagenesDeVariante,
} from "@/modules/media/subir";
import { clave, TAMANOS } from "@/modules/media/tamanos";
import { rechazaLlamada } from "@/tests/apoyo/errores";
import { existe, jpeg } from "@/tests/apoyo/imagenes";

/**
 * F2.4 — RF-16, RF-17, RN-11b, §5.4, §8.1, §9.2, §9.5. Contra Postgres y
 * contra Storage de verdad.
 *
 * Migrado de `scripts/verificar-variantes.mts` (F4.0b).
 *
 * Lo que se prueba es lo que NO se ve leyendo el código:
 *
 *   · Que el orden de las imágenes se mantenga consistente después de borrar
 *     una del medio. Es el error que F2.4 arregló: `sort_order` es a la vez el
 *     orden de la galería y el número de la próxima subida, y borrar la
 *     primera de tres dejaba dos imágenes con el mismo número — o sea, la
 *     portada del producto cambiando sola.
 *   · Que borrar un producto se lleve los archivos de todas sus variantes.
 *   · Que las restricciones de la base sean las que uno cree que son.
 *
 * Los bloques de abajo son SECUENCIALES: comparten un producto y van
 * construyendo sobre él, igual que el flujo real del panel.
 */

describe("validación (RF-16)", () => {
  const base = { productId: crypto.randomUUID(), colorId: null };

  test("una variante sin color y con stock cero es válida (la variante «Único»)", () => {
    expect(crearVariante.safeParse({ ...base, stockTotal: 0 }).success).toBe(true);
  });

  /**
   * La columna admite negativos —§5.4, es la señal de discrepancia de RF-24—
   * pero ESCRIBIRLO A MANO no es eso: el negativo tiene que llegar por una
   * venta que descontó de más, no por alguien tipeando −3 en un formulario.
   */
  test("un stock negativo escrito a mano se rechaza, aunque la columna lo admita", () => {
    expect(crearVariante.safeParse({ ...base, stockTotal: -3 }).success).toBe(false);
  });

  test("media unidad no existe", () => {
    expect(crearVariante.safeParse({ ...base, stockTotal: 2.5 }).success).toBe(false);
  });

  test("el stock llega como número, no como texto", () => {
    expect(crearVariante.safeParse({ ...base, stockTotal: "5" }).success).toBe(false);
  });

  test("un orden de seis imágenes se rechaza: entran cinco (RF-17)", () => {
    expect(
      ordenDeImagenes.safeParse({
        variantId: crypto.randomUUID(),
        ids: Array.from({ length: 6 }, () => crypto.randomUUID()),
      }).success,
    ).toBe(false);
  });
});

describe("contra la base y contra Storage", () => {
  const marca = String(Date.now());

  let marcaId = "";
  let categoriaId = "";
  let negro = "";
  let blanco = "";
  let producto = "";
  let vNegro = "";
  let vBlanco = "";
  const creados: string[] = [];

  async function unaFila(consulta: ReturnType<typeof sql>) {
    const [f] = await db.execute<{ id: string }>(consulta);
    return f.id;
  }

  beforeAll(async () => {
    marcaId = await unaFila(sql`
      INSERT INTO brands (name, slug)
      VALUES ('Prueba Variantes', ${`prueba-var-${marca}`}) RETURNING id`);
    categoriaId = await unaFila(sql`
      INSERT INTO categories (name, slug)
      VALUES ('Prueba Variantes', ${`prueba-var-cat-${marca}`}) RETURNING id`);
    negro = await unaFila(sql`
      INSERT INTO colors (name, slug, hex_code)
      VALUES (${`Negro ${marca}`}, ${`negro-${marca}`}, '#111111') RETURNING id`);
    blanco = await unaFila(sql`
      INSERT INTO colors (name, slug, hex_code)
      VALUES (${`Blanco ${marca}`}, ${`blanco-${marca}`}, '#eeeeee') RETURNING id`);

    producto = await unaFila(sql`
      INSERT INTO products (name, slug, brand_id, category_id, price)
      VALUES ('Producto de variantes', ${`producto-var-${marca}`},
              ${marcaId}, ${categoriaId}, 1000) RETURNING id`);
    creados.push(producto);

    vNegro = await unaFila(sql`
      INSERT INTO product_variants (product_id, color_id, stock_total)
      VALUES (${producto}, ${negro}, 10) RETURNING id`);
    vBlanco = await unaFila(sql`
      INSERT INTO product_variants (product_id, color_id, stock_total)
      VALUES (${producto}, ${blanco}, 4) RETURNING id`);
  });

  afterAll(async () => {
    // Las imágenes que hayan quedado se van por su propia función, que borra
    // fila Y archivos: un DELETE en cascada se llevaría las filas y dejaría
    // los archivos en el bucket sin nada que los nombre.
    const restantes = await db.execute<{ id: string }>(sql`
      SELECT i.id FROM variant_images i
        JOIN product_variants v ON v.id = i.variant_id
       WHERE v.product_id = ANY(ARRAY[${sql.join(
         creados.map((id) => sql`${id}::uuid`),
         sql`, `,
       )}])`);
    for (const r of restantes) {
      await borrarImagenDeVariante(r.id).catch(() => {});
    }

    if (creados.length) {
      await db.delete(products).where(inArray(products.id, creados));
    }
    await db.delete(colors).where(inArray(colors.id, [negro, blanco]));
    await db.delete(brands).where(inArray(brands.id, [marcaId]));
    await db.delete(categories).where(inArray(categories.id, [categoriaId]));
  });

  describe("restricciones de la base (§5.4)", () => {
    test("dos variantes del mismo color en un producto se rechazan", async () => {
      await rechazaLlamada(
        () =>
          db.execute(sql`
            INSERT INTO product_variants (product_id, color_id)
            VALUES (${producto}, ${negro})`),
        /variant_product_color_key|duplicate key/i,
      );
    });

    /**
     * La variante única entra por el COALESCE del índice. Sin él, dos filas
     * con `color_id` NULL no chocarían —en SQL, NULL nunca es igual a NULL— y
     * un producto podría terminar con dos variantes «Único».
     */
    test("dos variantes SIN color en un producto se rechazan", async () => {
      await db.execute(
        sql`INSERT INTO product_variants (product_id) VALUES (${producto})`,
      );
      await rechazaLlamada(
        () =>
          db.execute(
            sql`INSERT INTO product_variants (product_id) VALUES (${producto})`,
          ),
        /variant_product_color_key|duplicate key/i,
      );
      await db.execute(sql`
        DELETE FROM product_variants
         WHERE product_id = ${producto} AND color_id IS NULL`);
    });

    test("una variante que se reutiliza a sí misma se rechaza", async () => {
      await rechazaLlamada(
        () =>
          db.execute(sql`
            UPDATE product_variants SET images_source_id = id WHERE id = ${vNegro}`),
        /images_source_not_self/i,
      );
    });

    test("un stock total negativo se acepta (RF-24, §5.4)", async () => {
      // No es un error: es la SEÑAL de que el stock del sistema y el del
      // depósito no coinciden. Prohibirlo escondería la discrepancia.
      await db.execute(
        sql`UPDATE product_variants SET stock_total = -2 WHERE id = ${vBlanco}`,
      );
      const [f] = await db.execute<{ total: number }>(
        sql`SELECT stock_total AS total FROM product_variants WHERE id = ${vBlanco}`,
      );
      expect(f.total).toBe(-2);

      await db.execute(
        sql`UPDATE product_variants SET stock_total = 4 WHERE id = ${vBlanco}`,
      );
    });

    test("bajar el total por debajo de lo reservado se rechaza", async () => {
      await db.execute(
        sql`UPDATE product_variants SET reserved_stock = 3 WHERE id = ${vNegro}`,
      );
      await rechazaLlamada(
        () =>
          db.execute(
            sql`UPDATE product_variants SET stock_total = 1 WHERE id = ${vNegro}`,
          ),
        /reserved_within_total/i,
      );
      await db.execute(
        sql`UPDATE product_variants SET reserved_stock = 0 WHERE id = ${vNegro}`,
      );
    });
  });

  describe("reutilizar imágenes (§9.5)", () => {
    test("una variante que reutiliza las de otra no puede tener imágenes propias", async () => {
      await db.execute(sql`
        UPDATE product_variants SET images_source_id = ${vNegro}
         WHERE id = ${vBlanco}`);

      // §9.5 permite UN salto, no una cadena: si la que presta pudiera además
      // tener propias, «de dónde salen las fotos de esta variante» dejaría de
      // tener una sola respuesta.
      await rechazaLlamada(() =>
        publicarImagenDeVariante({
          productId: producto,
          variantId: vBlanco,
          archivo: Buffer.from([]),
        }),
      );
    });
  });

  describe("orden y principal (RF-17)", () => {
    let foto: Buffer;
    const subidas: { id: string; storageKey: string }[] = [];

    const posiciones = async () =>
      db.execute<{ id: string; n: number }>(sql`
        SELECT id, sort_order AS n FROM variant_images
         WHERE variant_id = ${vNegro} ORDER BY sort_order`);

    test("tres subidas quedan en 0, 1 y 2", async () => {
      foto = await jpeg(400, 300);
      for (let i = 0; i < 3; i++) {
        subidas.push(
          await publicarImagenDeVariante({
            productId: producto,
            variantId: vNegro,
            archivo: foto,
          }),
        );
      }
      expect((await posiciones()).map((x) => x.n)).toEqual([0, 1, 2]);
    });

    test("subir a una variante de OTRO producto con el id equivocado se rechaza", async () => {
      await rechazaLlamada(() =>
        publicarImagenDeVariante({
          productId: crypto.randomUUID(),
          variantId: vNegro,
          archivo: foto,
        }),
      );
    });

    test("«hacer principal» deja la elegida en la posición 0", async () => {
      // Elegir la principal es mover al frente: la tercera pasa a ser la 0.
      const orden = (await posiciones()).map((x) => x.id);
      await reordenarImagenesDeVariante(vNegro, [orden[2], orden[0], orden[1]]);

      const reordenadas = await posiciones();
      expect(reordenadas[0].id).toBe(orden[2]);
      expect(reordenadas.map((x) => x.n)).toEqual([0, 1, 2]);
    });

    test("un orden al que le falta una imagen se rechaza", async () => {
      const orden = (await posiciones()).map((x) => x.id);
      await rechazaLlamada(() =>
        reordenarImagenesDeVariante(vNegro, [orden[0]]),
      );
    });

    test("un orden con una imagen repetida se rechaza", async () => {
      const orden = (await posiciones()).map((x) => x.id);
      await rechazaLlamada(() =>
        reordenarImagenesDeVariante(vNegro, [orden[0], orden[0], orden[1]]),
      );
    });

    /**
     * EL ERROR QUE F2.4 ARREGLÓ, y el motivo de todo este bloque.
     *
     * Sin la renumeración: se borra la primera de tres, quedan [1, 2], y la
     * próxima subida —que se numeraba con la CANTIDAD, que es 2— vuelve a ser
     * 2. Dos imágenes en la misma posición, y el orden de la galería pasando a
     * depender de cuál devuelva antes Postgres: la portada del producto
     * cambiando sola entre dos recargas.
     */
    test("borrar la principal renumera las que quedan a 0 y 1, y se lleva sus archivos", async () => {
      const antes = await posiciones();
      const borrada = subidas.find((s) => s.id === antes[0].id)!;
      const claves = TAMANOS.map(({ sufijo }) => clave(borrada.storageKey, sufijo));

      await borrarImagenDeVariante(antes[0].id);

      expect((await posiciones()).map((x) => x.n)).toEqual([0, 1]);
      expect(await Promise.all(claves.map(existe))).toEqual([false, false, false]);
    });

    test("la siguiente subida entra en la 2 sin repetir número, y va al final", async () => {
      const cuarta = await publicarImagenDeVariante({
        productId: producto,
        variantId: vNegro,
        archivo: foto,
      });

      const conLaCuarta = await posiciones();
      expect(conLaCuarta.map((x) => x.n)).toEqual([0, 1, 2]);
      // Al final y no al frente: reordenar es otra acción, y una subida que
      // se pusiera de portada cambiaría la vitrina sin que nadie lo pida.
      expect(conLaCuarta.at(-1)!.id).toBe(cuarta.id);
    });
  });

  describe("borrar se lleva los archivos", () => {
    let delProducto: string[];

    test("`clavesDeVariante` devuelve las claves de sus 3 imágenes", async () => {
      const deLaVariante = await clavesDeVariante(vNegro);
      expect(deLaVariante).toHaveLength(3 * TAMANOS.length);
    });

    test("`clavesDeProducto` junta las de todas sus variantes, y están en Storage", async () => {
      delProducto = await clavesDeProducto(producto);
      expect(delProducto).toHaveLength(3 * TAMANOS.length);
      expect(await Promise.all(delProducto.map(existe))).toEqual(
        delProducto.map(() => true),
      );
    });

    /**
     * El camino completo de `eliminarUnProducto`: LEER, borrar la fila, borrar
     * los archivos. Sin la primera lectura, el DELETE en cascada se lleva
     * `variant_images` y con ella la única referencia a los archivos, que
     * quedan en el bucket para siempre sin nada que los nombre.
     */
    test("borrar el producto deja Storage sin ninguno de sus archivos", async () => {
      await db.delete(products).where(inArray(products.id, [producto]));
      creados.length = 0;
      await borrarArchivos(delProducto);

      expect(await Promise.all(delProducto.map(existe))).toEqual(
        delProducto.map(() => false),
      );
    });

    test("y la cascada se llevó las filas de `variant_images`", async () => {
      const [{ n }] = await db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM variant_images WHERE variant_id = ${vNegro}`);
      expect(n).toBe(0);
    });
  });

  describe("RN-11b sobre colores", () => {
    let p2 = "";
    let vActiva = "";

    const uso = async (colorId: string) => {
      const [f] = await db.execute<{ activos: number; total: number }>(sql`
        SELECT count(*) FILTER (WHERE is_active)::int AS activos,
               count(*)::int AS total
          FROM (SELECT bool_or(v.is_active AND p.is_active) AS is_active
                  FROM product_variants v
                  JOIN products p ON p.id = v.product_id
                 WHERE v.color_id = ${colorId}
                 GROUP BY p.id) AS usos`);
      return f;
    };

    test("una variante activa de un producto activo bloquea desactivar el color", async () => {
      p2 = await unaFila(sql`
        INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
        VALUES ('Producto RN11b', ${`producto-rn11b-${marca}`},
                ${marcaId}, ${categoriaId}, 1000, true) RETURNING id`);
      creados.push(p2);

      vActiva = await unaFila(sql`
        INSERT INTO product_variants (product_id, color_id, is_active)
        VALUES (${p2}, ${negro}, true) RETURNING id`);

      expect(await uso(negro)).toEqual({ activos: 1, total: 1 });
    });

    test("con la variante desactivada ya no bloquea, pero sigue contando como uso (RN-11)", async () => {
      await db.execute(
        sql`UPDATE product_variants SET is_active = false WHERE id = ${vActiva}`,
      );
      // Las dos cifras responden preguntas distintas: `activos` decide si se
      // puede DESACTIVAR el color, `total` si se puede BORRAR.
      expect(await uso(negro)).toEqual({ activos: 0, total: 1 });
    });
  });
});
