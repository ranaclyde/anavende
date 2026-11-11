import { sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  activarMarca,
  archivoDeMarca,
  borrarImagenDeMarca,
  estaActiva,
  guardarCapas,
  leerCapas,
  marcaParaSubir,
  subirImagenDeMarca,
  type CapaGuardada,
} from "@/modules/marca-de-agua/service";
import {
  borrarImagenDeVariante,
  publicarImagenDeVariante,
} from "@/modules/media/subir";
import { clave } from "@/modules/media/tamanos";
import { almacen, existe, jpeg } from "@/tests/apoyo/imagenes";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { rechazaLlamada } from "@/tests/apoyo/errores";

/**
 * F2.16 — La biblioteca, las capas y el interruptor, contra la base y
 * Storage de verdad (RF-39, TS §9.6).
 *
 * La marca es UNA para toda la tienda, así que el test guarda cómo estaba y
 * la deja igual al terminar: contra el stack local puede haber una armada a
 * mano para probar el panel.
 */

let antes: { activa: boolean; capas: CapaGuardada[] };

beforeAll(async () => {
  antes = { activa: await estaActiva(), capas: await leerCapas() };
  await guardarCapas([]);
});

afterAll(async () => {
  await guardarCapas(antes.capas);
  if (antes.activa) await activarMarca(true);
  await limpiar();
});

/** Un PNG rojo opaco: fácil de encontrar en la foto. */
async function pngRojo(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

const cubreTodo = (imageId: string): CapaGuardada => ({
  imageId,
  mode: "estirar",
  anchor: "centro",
  sizePct: 20,
  marginPct: 0,
  opacityPct: 100,
});

async function centro(key: string): Promise<{ r: number; g: number }> {
  const r = await fetch(almacen.publicUrl(key));
  const { data, info } = await sharp(Buffer.from(await r.arrayBuffer()))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i =
    (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) *
    info.channels;
  return { r: data[i], g: data[i + 1] };
}

describe("la biblioteca", () => {
  test("un PNG se guarda una vez, en WEBP, y se puede borrar", async () => {
    const imagen = await subirImagenDeMarca(await pngRojo(), "logo-ana.png");
    expect(imagen.name).toBe("logo-ana");
    expect(await existe(archivoDeMarca(imagen.storageKey))).toBe(true);

    await borrarImagenDeMarca(imagen.id);
    expect(await existe(archivoDeMarca(imagen.storageKey))).toBe(false);
  });

  test("un JPG se rechaza: no tiene transparencia", async () => {
    const foto = await jpeg(50, 50);
    await rechazaLlamada(() => subirImagenDeMarca(foto, "foto.jpg"), /PNG/);
  });
});

describe("el interruptor", () => {
  test("no se puede activar sin capas", async () => {
    const motivo = await activarMarca(true).then(
      () => "",
      (e: Error) => e.message,
    );
    expect(motivo).toMatch(/al menos una capa/);
    expect(await estaActiva()).toBe(false);
  });

  test("borrar la imagen de la única capa apaga la marca y se lleva la capa", async () => {
    const imagen = await subirImagenDeMarca(await pngRojo(), "a.png");
    await guardarCapas([cubreTodo(imagen.id)]);
    await activarMarca(true);

    const { seApago } = await borrarImagenDeMarca(imagen.id);

    expect(seApago).toBe(true);
    expect(await estaActiva()).toBe(false);
    expect(await leerCapas()).toEqual([]);
  });

  test("desactivar no borra las capas ni las imágenes", async () => {
    const imagen = await subirImagenDeMarca(await pngRojo(), "b.png");
    await guardarCapas([cubreTodo(imagen.id)]);
    await activarMarca(true);
    await activarMarca(false);

    expect(await leerCapas()).toHaveLength(1);
    expect(await existe(archivoDeMarca(imagen.storageKey))).toBe(true);

    await borrarImagenDeMarca(imagen.id);
  });
});

describe("la subida de una foto de producto", () => {
  let imageId = "";

  beforeAll(async () => {
    imageId = (await subirImagenDeMarca(await pngRojo(), "c.png")).id;
    await guardarCapas([cubreTodo(imageId)]);
  });

  afterAll(async () => {
    await borrarImagenDeMarca(imageId);
  });

  test("activa: la tarjeta y el detalle llevan la marca y la fila lo dice", async () => {
    await activarMarca(true);
    const { productId, variantId } = await unaVariante();

    const subida = await publicarImagenDeVariante({
      productId,
      variantId,
      archivo: await jpeg(800, 600),
    });

    try {
      const [fila] = await db.execute<{ marca: boolean }>(sql`
        SELECT has_watermark AS marca FROM variant_images WHERE id = ${subida.id}`);
      expect(fila.marca).toBe(true);

      for (const sufijo of ["card", "detail"]) {
        const p = await centro(clave(subida.storageKey, sufijo));
        expect(p.r).toBeGreaterThan(200);
        expect(p.g).toBeLessThan(60);
      }
    } finally {
      await borrarImagenDeVariante(subida.id);
    }
  });

  test("desactivada: la foto sale sin marca, con las capas guardadas", async () => {
    await activarMarca(false);
    expect(await marcaParaSubir()).toEqual([]);

    const { productId, variantId } = await unaVariante();
    const subida = await publicarImagenDeVariante({
      productId,
      variantId,
      archivo: await jpeg(800, 600),
    });

    try {
      const [fila] = await db.execute<{ marca: boolean }>(sql`
        SELECT has_watermark AS marca FROM variant_images WHERE id = ${subida.id}`);
      expect(fila.marca).toBe(false);
      expect(await leerCapas()).toHaveLength(1);
    } finally {
      await borrarImagenDeVariante(subida.id);
    }
  });
});
