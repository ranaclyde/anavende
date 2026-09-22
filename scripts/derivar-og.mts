/**
 * Genera la imagen de vista previa del sitio — F3.9, RNF-04.
 *
 * Es la que sale abajo del enlace cuando alguien manda `anavende.com.ar` por
 * WhatsApp y la página que se comparte no es una ficha.
 *
 * **Vive en `public/` y no en `app/opengraph-image.png`**, que es la vía que
 * Next ofrece sola. Se probó y no sirve acá: los metadatos se pisan campo por
 * campo, así que toda pantalla que declara su propio `openGraph` —la home, el
 * catálogo, la ficha— perdía la imagen que Next inyecta por el nombre del
 * archivo, y quedaban con vista previa solo las que no declaran nada. Un
 * archivo común, nombrado una vez en `OPEN_GRAPH_BASE`, llega a todas.
 *
 * **Sin texto adentro, y es una decisión.** El nombre ya viaja en `og:title` y
 * WhatsApp lo muestra al lado de la miniatura: repetirlo en la imagen sería
 * decirlo dos veces, y obligaría a incrustar una fuente para que el dibujo
 * salga igual en cualquier máquina que corra esto.
 *
 * Se deriva del logo, como `derivar-logo.mts` y por el mismo motivo: el día
 * que la marca cambie, esto se vuelve a correr y no hay una segunda versión
 * que se quedó vieja.
 *
 *   npx tsx scripts/derivar-og.mts
 */
import { stat } from "node:fs/promises";

import sharp from "sharp";

/** Lo que pide Open Graph: 1200×630, la proporción que recortan todos igual. */
const ANCHO = 1200;
const ALTO = 630;

/** `--brand` de DESIGN-REFERENCE §3.1. El logo claro da 9,07:1 encima. */
const BURDEOS = { r: 0x83, g: 0x28, b: 0x33, alpha: 1 };

/** Poco menos de la mitad del alto: deja aire y sobrevive a la miniatura. */
const ALTO_DEL_LOGO = 280;

const ORIGEN = "public/marca/logo-claro.png";
const DESTINO = "public/marca/og.png";

const logo = await sharp(ORIGEN)
  .resize({ height: ALTO_DEL_LOGO, withoutEnlargement: true })
  .toBuffer();

await sharp({
  create: { width: ANCHO, height: ALTO, channels: 4, background: BURDEOS },
})
  // `gravity: center` y no coordenadas a mano: si el logo cambia de
  // proporción, sigue quedando en el medio sin tocar este archivo.
  .composite([{ input: logo, gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile(DESTINO);

const { size } = await stat(DESTINO);
console.log(`${DESTINO} — ${ANCHO}x${ALTO}, ${Math.round(size / 1024)} KB`);
