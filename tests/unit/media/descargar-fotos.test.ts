import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { armarZip } from "@/lib/zip";
import {
  fotosDelProducto,
  nombresEnElZip,
  zipDeFotos,
} from "@/modules/media/descargar";
import {
  borrarImagenDeVariante,
  publicarImagenDeVariante,
} from "@/modules/media/subir";
import { limpiar, unaVariante, unProducto } from "@/tests/apoyo/catalogo";
import { jpeg, png } from "@/tests/apoyo/imagenes";

/**
 * F2.18 — Las fotos de un producto en un zip.
 *
 * El zip se arma a mano (`lib/zip.ts`), así que lo abren el `unzip` del
 * sistema —que verifica los CRC— y el `zipfile` de Python, y no el mismo
 * código que lo escribió: si los dos se equivocaran
 * igual, el test pasaría con un zip que nadie más puede abrir.
 */

const carpeta = mkdtempSync(join(tmpdir(), "zip-"));

afterAll(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

/** Escribe el zip y devuelve su ruta, para dárselo a `unzip`. */
function enDisco(zip: Buffer): string {
  const ruta = join(carpeta, `${randomUUID()}.zip`);
  writeFileSync(ruta, zip);
  return ruta;
}

/**
 * Los nombres, según el `zipfile` de Python: el `unzip` de macOS ignora la
 * bandera de UTF-8 al listar y mostraría «marr+n».
 */
function nombresSegunUnzip(ruta: string): string[] {
  return JSON.parse(
    execFileSync(
      "python3",
      [
        "-I",
        "-c",
        "import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))",
        ruta,
      ],
      { encoding: "utf8" },
    ),
  ) as string[];
}

function leer(ruta: string, nombre: string): Buffer {
  return execFileSync("python3", [
    "-I",
    "-c",
    "import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))",
    ruta,
    nombre,
  ]);
}

describe("armarZip", () => {
  test("unzip lo abre, lo verifica y devuelve los mismos bytes", () => {
    const a = Buffer.from("hola");
    const b = Buffer.alloc(70_000, 7);
    const ruta = enDisco(
      armarZip([
        { nombre: "marrón/1.jpg", datos: a },
        { nombre: "2.jpg", datos: b },
      ]),
    );

    // `-t` recalcula el CRC de cada archivo.
    expect(execFileSync("unzip", ["-t", ruta], { encoding: "utf8" })).toMatch(
      /No errors detected/,
    );
    expect(nombresSegunUnzip(ruta)).toEqual(["marrón/1.jpg", "2.jpg"]);
    expect(leer(ruta, "marrón/1.jpg").equals(a)).toBe(true);
    expect(leer(ruta, "2.jpg").equals(b)).toBe(true);
  });

  test.each(["", "/raiz.jpg", "../afuera.jpg", "a/../../b.jpg"])(
    "rechaza el nombre «%s»",
    (nombre) => {
      expect(() => armarZip([{ nombre, datos: Buffer.from("x") }])).toThrow(
        TypeError,
      );
    },
  );
});

describe("nombresEnElZip", () => {
  const k = "x";

  test("una carpeta por color, numeradas desde 1 en el orden que llegan", () => {
    expect(
      nombresEnElZip([
        { color: "Negro", storageKey: k },
        { color: "Negro", storageKey: k },
        { color: "Rojo/Blanco", storageKey: k },
        { color: "Marrón", storageKey: k },
      ]),
    ).toEqual([
      "negro/1.jpg",
      "negro/2.jpg",
      "rojo-blanco/1.jpg",
      "marron/1.jpg",
    ]);
  });

  test("sin color, sueltas", () => {
    expect(
      nombresEnElZip([
        { color: null, storageKey: k },
        { color: null, storageKey: k },
      ]),
    ).toEqual(["1.jpg", "2.jpg"]);
  });

  test("dos colores que dan la misma carpeta no se pisan", () => {
    expect(
      nombresEnElZip([
        { color: "Negro/Rojo", storageKey: k },
        { color: "Negro Rojo", storageKey: k },
        { color: "Negro/Rojo", storageKey: k },
      ]),
    ).toEqual(["negro-rojo/1.jpg", "negro-rojo-2/1.jpg", "negro-rojo/2.jpg"]);
  });
});

describe("las fotos de un producto, contra la base y Storage", () => {
  let productId: string;
  const subidas: string[] = [];
  let colorId: string;

  beforeAll(async () => {
    // Una variante sin color (la de `unaVariante`) y otra «Gris …» con
    // color, después; y una tercera que reutiliza las fotos de la gris.
    const unica = await unaVariante();
    productId = unica.productId;
    const sufijo = randomUUID().slice(0, 8);
    const [color] = await db.execute<{ id: string }>(sql`
      INSERT INTO colors (name, slug, hex_code)
      VALUES (${`Gris ${sufijo}`}, ${`gris-${sufijo}`}, '#888888')
      RETURNING id`);
    colorId = color.id;
    // `unaVariante` dejó la suya sin color; esta otra se ordena después.
    const [gris] = await db.execute<{ id: string }>(sql`
      INSERT INTO product_variants (product_id, color_id, sort_order)
      VALUES (${productId}, ${colorId}, 1)
      RETURNING id`);

    for (const [variantId, archivo] of [
      [unica.variantId, await jpeg(800, 600)],
      [gris.id, await png(600, 800)],
      [gris.id, await jpeg(500, 500)],
    ] as const) {
      const subida = await publicarImagenDeVariante({
        productId,
        variantId,
        archivo,
      });
      subidas.push(subida.id);
    }
  });

  afterAll(async () => {
    for (const id of subidas) await borrarImagenDeVariante(id);
    await limpiar();
    await db.execute(sql`DELETE FROM colors WHERE id = ${colorId}`);
  });

  test("trae las propias de cada color, en el orden del panel", async () => {
    const producto = await fotosDelProducto(productId);
    expect(producto?.fotos.map((f) => f.color)).toEqual([
      null,
      expect.stringMatching(/^Gris /),
      expect.stringMatching(/^Gris /),
    ]);
  });

  test("el zip trae JPG de la versión grande, con el orden y las carpetas", async () => {
    const producto = await fotosDelProducto(productId);
    const zip = await zipDeFotos(producto!);
    const ruta = enDisco(zip!);

    const nombres = nombresSegunUnzip(ruta);
    expect(nombres).toEqual([
      "1.jpg",
      expect.stringMatching(/^gris-[0-9a-f]{8}\/1\.jpg$/),
      expect.stringMatching(/^gris-[0-9a-f]{8}\/2\.jpg$/),
    ]);

    // La vertical de 600 × 800 sale tal como la `-detail`: sin agrandar.
    const vertical = await sharp(leer(ruta, nombres[1])).metadata();
    expect(vertical).toMatchObject({ format: "jpeg", width: 600, height: 800 });
    for (const nombre of nombres) {
      expect((await sharp(leer(ruta, nombre)).metadata()).format).toBe("jpeg");
    }
  });

  test("las que un color reutiliza de otro no se repiten", async () => {
    const [prestada] = await db.execute<{ id: string }>(sql`
      INSERT INTO product_variants (product_id, color_id, sort_order, images_source_id)
      SELECT ${productId}, c.id, 2, v.id
        FROM colors c, product_variants v
       WHERE c.slug = 'negro' AND v.color_id = ${colorId}
         AND v.product_id = ${productId}
      RETURNING id`);
    try {
      const producto = await fotosDelProducto(productId);
      expect(producto?.fotos).toHaveLength(3);
    } finally {
      if (prestada) {
        await db.execute(
          sql`DELETE FROM product_variants WHERE id = ${prestada.id}`,
        );
      }
    }
  });

  test("sin fotos no hay zip, y un producto que no existe es null", async () => {
    const vacio = await unProducto();
    const producto = await fotosDelProducto(vacio);
    expect(producto?.fotos).toEqual([]);
    expect(await zipDeFotos(producto!)).toBeNull();
    expect(await fotosDelProducto(randomUUID())).toBeNull();
  });
});
