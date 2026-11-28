/**
 * Genera la imagen de vista previa del sitio (RNF-04), derivada del logo.
 *
 * Vive en `public/` y no en `app/opengraph-image.png`: Next pisa `openGraph`
 * campo por campo, y las pantallas que declaran el suyo perdían la imagen.
 * Se nombra una vez en `OPEN_GRAPH_BASE`.
 *
 *   npx tsx scripts/derivar-og.mts
 */
import { stat } from "node:fs/promises";

import sharp from "sharp";

import { markSvg } from "../lib/logo";

const ANCHO = 1200;
const ALTO = 630;

/** `--brand` de DESIGN-REFERENCE §3.1. */
const BURDEOS = { r: 0x83, g: 0x28, b: 0x33, alpha: 1 };

const ALTO_DEL_LOGO = 280;

const DESTINO = "public/marca/og.png";

const logo = await sharp(Buffer.from(markSvg("#ffffff")), {
  density: 300,
})
  .resize({ height: ALTO_DEL_LOGO })
  .toBuffer();

await sharp({
  create: { width: ANCHO, height: ALTO, channels: 4, background: BURDEOS },
})
  .composite([{ input: logo, gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile(DESTINO);

const { size } = await stat(DESTINO);
console.log(`${DESTINO} — ${ANCHO}x${ALTO}, ${Math.round(size / 1024)} KB`);
