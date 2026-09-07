import sharp from "sharp";

import { almacenamiento } from "@/lib/storage";

/**
 * Andamiaje para los tests que tocan Storage de verdad — F2.2, F2.4 y F2.6.
 *
 * §17.1 pide Storage real y no un doble, y el motivo está a la vista en lo que
 * estos tests encuentran: archivos huérfanos, tamaños que no se generan,
 * claves que no se borran al reemplazar. Nada de eso lo reproduce un *mock*,
 * que diría que sí a todo.
 *
 * Contra el stack local, siempre: `tests/setup/entorno.ts` verifica que la API
 * de Supabase sea loopback:54321 y aborta si no.
 */

/**
 * La MISMA instancia que usa el código de producción: `almacenamiento()` la
 * cachea en el módulo. Se exporta porque el test de «sin huérfanos» (F2.2)
 * necesita romperle `put` a propósito, y contra otra instancia el fallo no
 * llegaría a la canalización que se quiere probar.
 */
export const almacen = almacenamiento();

/**
 * Un PNG con ruido, no un color plano.
 *
 * Un PNG de un solo color se comprime a nada, y entonces una prueba de «pesa
 * más de X» o de conversión pasaría por el peso del formato y no por lo que se
 * quiere probar. Con ruido, el archivo pesa lo que dice pesar.
 */
export async function png(ancho = 300, alto = 200): Promise<Buffer> {
  const pixeles = Buffer.allocUnsafe(ancho * alto * 3);
  for (let i = 0; i < pixeles.length; i++) {
    pixeles[i] = Math.floor(Math.random() * 256);
  }
  return sharp(pixeles, { raw: { width: ancho, height: alto, channels: 3 } })
    .png()
    .toBuffer();
}

/** Un JPEG, para el camino de conversión de F2.2. */
export async function jpeg(ancho = 300, alto = 200, calidad = 90): Promise<Buffer> {
  const pixeles = Buffer.allocUnsafe(ancho * alto * 3);
  for (let i = 0; i < pixeles.length; i++) {
    pixeles[i] = Math.floor(Math.random() * 256);
  }
  return sharp(pixeles, { raw: { width: ancho, height: alto, channels: 3 } })
    .jpeg({ quality: calidad })
    .toBuffer();
}

/**
 * ¿El archivo está en el bucket?
 *
 * Va por HTTP contra la URL pública y no por la API de Storage a propósito: es
 * la misma puerta por la que lo va a pedir el navegador de un comprador. Un
 * archivo que existe para la API y no se sirve es un archivo que no existe.
 */
export async function existe(key: string): Promise<boolean> {
  const r = await fetch(almacen.publicUrl(key), { method: "HEAD" });
  return r.ok;
}
