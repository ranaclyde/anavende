import sharp from "sharp";
import { describe, expect, test } from "vitest";

import {
  ponerMarca,
  ubicar,
  type CapaLista,
} from "@/modules/media/marca-de-agua";
import { procesarImagen } from "@/modules/media/procesar";

/**
 * F2.16 — La marca de agua: dónde cae cada capa, en qué versiones y con qué
 * opacidad (RF-39, TECHNICAL-SPEC §9.6).
 *
 * Sin Storage ni base: la composición recibe los bytes de la capa ya leídos,
 * así que se prueba con imágenes armadas acá. Lo que se mira son píxeles.
 */

/** Una foto gris parejo: cualquier píxel que no sea gris lo puso la marca. */
async function fotoGris(ancho: number, alto: number): Promise<Buffer> {
  return sharp({
    create: {
      width: ancho,
      height: alto,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** Un cuadrado rojo opaco, la capa más fácil de encontrar. */
async function cuadradoRojo(lado = 100): Promise<Buffer> {
  return sharp({
    create: {
      width: lado,
      height: lado,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

const capa = (cambios: Partial<CapaLista> & { imagen: Buffer }): CapaLista => ({
  mode: "posicion",
  anchor: "abajo-derecha",
  sizePct: 20,
  marginPct: 0,
  opacityPct: 100,
  ...cambios,
});

/** El color de un píxel de un buffer codificado. */
async function pixel(
  imagen: Buffer,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(imagen)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

const esRojo = (p: { r: number; g: number; b: number }) =>
  p.r > 200 && p.g < 60 && p.b < 60;
const esGris = (p: { r: number; g: number; b: number }) =>
  Math.abs(p.r - 128) < 12 &&
  Math.abs(p.g - 128) < 12 &&
  Math.abs(p.b - 128) < 12;

describe("dónde cae una capa en una posición", () => {
  const lienzo = { ancho: 1000, alto: 600 };
  const mide = { w: 200, h: 100 };

  test.each([
    ["arriba-izquierda", 30, 30],
    ["arriba", 400, 30],
    ["arriba-derecha", 770, 30],
    ["izquierda", 30, 250],
    ["centro", 400, 250],
    ["derecha", 770, 250],
    ["abajo-izquierda", 30, 470],
    ["abajo", 400, 470],
    ["abajo-derecha", 770, 470],
  ] as const)("%s", (ancla, left, top) => {
    expect(ubicar(ancla, mide, lienzo, 30)).toEqual({ left, top });
  });

  test("nunca queda afuera del lienzo", () => {
    expect(ubicar("abajo-derecha", { w: 1000, h: 600 }, lienzo, 30)).toEqual({
      left: 0,
      top: 0,
    });
  });
});

describe("la composición", () => {
  test("el tamaño es un porcentaje del ancho de la versión", async () => {
    const version = await sharp(await fotoGris(1000, 500))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const salida = await (
      await ponerMarca(version, [
        capa({
          imagen: await cuadradoRojo(),
          sizePct: 10,
          anchor: "arriba-izquierda",
        }),
      ])
    )
      .png()
      .toBuffer();

    // 10% de 1000 = un cuadrado de 100px desde la esquina.
    expect(esRojo(await pixel(salida, 5, 5))).toBe(true);
    expect(esRojo(await pixel(salida, 95, 95))).toBe(true);
    expect(esGris(await pixel(salida, 105, 105))).toBe(true);
  });

  test("la opacidad mezcla la capa con la foto", async () => {
    const version = await sharp(await fotoGris(400, 400))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const salida = await (
      await ponerMarca(version, [
        capa({ imagen: await cuadradoRojo(), mode: "estirar", opacityPct: 50 }),
      ])
    )
      .png()
      .toBuffer();

    // Mitad rojo, mitad gris: ~ (255+128)/2, (0+128)/2.
    const p = await pixel(salida, 200, 200);
    expect(p.r).toBeGreaterThan(180);
    expect(p.r).toBeLessThan(205);
    expect(p.g).toBeGreaterThan(55);
    expect(p.g).toBeLessThan(75);
  });

  test("lo transparente de la capa no tapa la foto", async () => {
    // Un PNG transparente salvo un punto rojo en el medio.
    const lado = 100;
    const pixeles = Buffer.alloc(lado * lado * 4);
    const medio = (50 * lado + 50) * 4;
    pixeles.set([255, 0, 0, 255], medio);
    const conHueco = await sharp(pixeles, {
      raw: { width: lado, height: lado, channels: 4 },
    })
      .png()
      .toBuffer();

    const version = await sharp(await fotoGris(400, 400))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const salida = await (
      await ponerMarca(version, [capa({ imagen: conHueco, mode: "estirar" })])
    )
      .png()
      .toBuffer();

    expect(esGris(await pixel(salida, 10, 10))).toBe(true);
    expect(esGris(await pixel(salida, 390, 390))).toBe(true);
  });

  test("el mosaico se repite por toda la foto", async () => {
    const version = await sharp(await fotoGris(1000, 1000))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const salida = await (
      await ponerMarca(version, [
        capa({ imagen: await cuadradoRojo(), mode: "mosaico", sizePct: 10 }),
      ])
    )
      .png()
      .toBuffer();

    // Un cuadrado opaco repetido sin hueco tapa todo, también la esquina
    // opuesta a donde arranca.
    expect(esRojo(await pixel(salida, 5, 5))).toBe(true);
    expect(esRojo(await pixel(salida, 995, 995))).toBe(true);
    expect(esRojo(await pixel(salida, 450, 730))).toBe(true);
  });

  test("cubrir tapa una foto de otra proporción sin dejar bordes", async () => {
    const version = await sharp(await fotoGris(300, 900))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const salida = await (
      await ponerMarca(version, [
        capa({ imagen: await cuadradoRojo(), mode: "cubrir" }),
      ])
    )
      .png()
      .toBuffer();

    expect(esRojo(await pixel(salida, 1, 1))).toBe(true);
    expect(esRojo(await pixel(salida, 298, 898))).toBe(true);
  });

  test("las capas se apilan en orden: la última queda arriba", async () => {
    const azul = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const version = await sharp(await fotoGris(200, 200))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const salida = await (
      await ponerMarca(version, [
        capa({ imagen: await cuadradoRojo(), mode: "estirar" }),
        capa({ imagen: azul, mode: "estirar" }),
      ])
    )
      .png()
      .toBuffer();

    const p = await pixel(salida, 100, 100);
    expect(p.b).toBeGreaterThan(200);
    expect(p.r).toBeLessThan(60);
  });
});

describe("en qué versiones de una foto de producto", () => {
  test("tarjeta y detalle llevan la marca; miniatura y vista previa no", async () => {
    const p = await procesarImagen(await fotoGris(1600, 1200), undefined, [
      capa({ imagen: await cuadradoRojo(), mode: "estirar" }),
    ]);
    const por = new Map(p.versiones.map((v) => [v.sufijo, v.cuerpo]));

    expect(esRojo(await pixel(por.get("card")!, 300, 200))).toBe(true);
    expect(esRojo(await pixel(por.get("detail")!, 700, 500))).toBe(true);
    expect(esGris(await pixel(por.get("thumb")!, 100, 75))).toBe(true);
    // La de Open Graph va sobre burdeos: el centro es la foto, gris.
    expect(esGris(await pixel(por.get("og")!, 600, 315))).toBe(true);
  });

  test("sin capas, la foto sale como siempre", async () => {
    const p = await procesarImagen(await fotoGris(1600, 1200));
    for (const v of p.versiones.filter((v) => v.sufijo !== "og")) {
      expect(esGris(await pixel(v.cuerpo, 10, 10))).toBe(true);
    }
  });

  test("las medidas guardadas no cambian por la marca", async () => {
    const sin = await procesarImagen(await fotoGris(1600, 1200));
    const con = await procesarImagen(await fotoGris(1600, 1200), undefined, [
      capa({ imagen: await cuadradoRojo(), mode: "mosaico" }),
    ]);
    expect({ ancho: con.ancho, alto: con.alto }).toEqual({
      ancho: sin.ancho,
      alto: sin.alto,
    });
  });
});
