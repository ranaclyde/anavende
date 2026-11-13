/**
 * Saca del logo en trazos (`lib/marca.ts`) los archivos que no pueden
 * dibujarlo en línea — DESIGN-REFERENCE §2.3, F10.7c.
 *
 *   public/marca/isotipo.svg         el isotipo, burdeos sobre transparente
 *   public/marca/logo.png            el mismo, 512×512 (datos estructurados)
 *   public/marca/logo-horizontal.png isotipo y palabra, para los correos
 *   app/favicon.ico                  16, 32 y 48 px
 *
 * La pestaña, los correos y Google no dibujan un componente de React: por eso
 * existen estos archivos. Se derivan en vez de mantenerse a mano para que no
 * se separen del logo si cambia. Después de correrlo, `derivar-og.mts`.
 *
 *   npx tsx scripts/derivar-logo.mts
 */
import { writeFile } from "node:fs/promises";

import sharp from "sharp";

import { svgDelIsotipo, svgHorizontal } from "../lib/marca";

/** `--brand` de DESIGN-REFERENCE §3.1. */
const BURDEOS = "#832833";

/** Un .ico con PNG adentro: lo aceptan todos los navegadores desde 2010. */
async function ico(lados: number[]) {
  const pngs = await Promise.all(
    lados.map((lado) =>
      sharp(Buffer.from(svgDelIsotipo(BURDEOS)), { density: 600 })
        .resize(lado, lado)
        .png()
        .toBuffer(),
    ),
  );
  const cabecera = Buffer.alloc(6 + 16 * lados.length);
  cabecera.writeUInt16LE(0, 0);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(lados.length, 4);
  let desplazamiento = cabecera.length;
  lados.forEach((lado, i) => {
    const o = 6 + 16 * i;
    cabecera.writeUInt8(lado % 256, o);
    cabecera.writeUInt8(lado % 256, o + 1);
    cabecera.writeUInt16LE(1, o + 4);
    cabecera.writeUInt16LE(32, o + 6);
    cabecera.writeUInt32LE(pngs[i].length, o + 8);
    cabecera.writeUInt32LE(desplazamiento, o + 12);
    desplazamiento += pngs[i].length;
  });
  return Buffer.concat([cabecera, ...pngs]);
}

await writeFile("public/marca/isotipo.svg", svgDelIsotipo(BURDEOS));

await sharp(Buffer.from(svgDelIsotipo(BURDEOS)), { density: 300 })
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile("public/marca/logo.png");

// El correo la muestra a 40 px de alto: se guarda al doble para pantallas
// de alta densidad.
await sharp(Buffer.from(svgHorizontal(BURDEOS)), { density: 300 })
  .resize({ height: 80 })
  .png({ compressionLevel: 9 })
  .toFile("public/marca/logo-horizontal.png");

await writeFile("app/favicon.ico", await ico([16, 32, 48]));

console.log("isotipo.svg, logo.png, logo-horizontal.png y favicon.ico listos");
