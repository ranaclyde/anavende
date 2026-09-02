/**
 * Genera la versión clara del logo a partir del original.
 *
 * `logo.png` es burdeos sobre transparente. Sobre el pie del sitio, que es
 * casi negro (`--ink`), eso queda ilegible: DESIGN-REFERENCE §2.3 pide una
 * versión de fondo oscuro. Se deriva del original en vez de mantenerse a
 * mano, para que las dos no se separen si el logo cambia.
 *
 * Se conserva el canal alfa del original —los bordes suavizados incluidos— y
 * se reemplaza el color por blanco.
 *
 *   npx tsx scripts/derivar-logo.mts
 */
import sharp from "sharp";

const ORIGEN = "public/marca/logo.png";
const DESTINO = "public/marca/logo-claro.png";

const { data, info } = await sharp(ORIGEN)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  data[i] = 255;
  data[i + 1] = 255;
  data[i + 2] = 255;
  // El alfa queda como estaba: la forma es la misma, cambia el color.
}

await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png({ compressionLevel: 9 })
  .toFile(DESTINO);

console.log(`${DESTINO} — ${info.width}x${info.height}`);
