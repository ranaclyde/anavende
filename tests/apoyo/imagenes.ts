import sharp from "sharp";

import { almacenamiento } from "@/lib/storage";

/**
 * La misma instancia que usa la aplicación (`almacenamiento()` la cachea): el
 * test de «sin huérfanos» le rompe `put`, y en otra instancia el fallo no
 * llegaría al código que se prueba.
 */
export const almacen = almacenamiento();

/** Con ruido y no de un color: un color plano se comprime a casi nada. */
export async function png(ancho = 300, alto = 200): Promise<Buffer> {
  const pixeles = Buffer.allocUnsafe(ancho * alto * 3);
  for (let i = 0; i < pixeles.length; i++) {
    pixeles[i] = Math.floor(Math.random() * 256);
  }
  return sharp(pixeles, { raw: { width: ancho, height: alto, channels: 3 } })
    .png()
    .toBuffer();
}

export async function jpeg(
  ancho = 300,
  alto = 200,
  calidad = 90,
): Promise<Buffer> {
  const pixeles = Buffer.allocUnsafe(ancho * alto * 3);
  for (let i = 0; i < pixeles.length; i++) {
    pixeles[i] = Math.floor(Math.random() * 256);
  }
  return sharp(pixeles, { raw: { width: ancho, height: alto, channels: 3 } })
    .jpeg({ quality: calidad })
    .toBuffer();
}

/** Por la URL pública y no por la API de Storage: es la que usa el navegador. */
export async function existe(key: string): Promise<boolean> {
  const r = await fetch(almacen.publicUrl(key), { method: "HEAD" });
  return r.ok;
}
