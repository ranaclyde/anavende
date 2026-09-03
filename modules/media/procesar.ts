import "server-only";

import sharp from "sharp";

import { domainError } from "@/lib/errors";
import { SUFIJO_MAYOR, TAMANOS, type Sufijo } from "@/modules/media/tamanos";
import { validarArchivo } from "@/modules/media/validar";

/**
 * Conversión y redimensionado — TECHNICAL-SPEC §9.0, §9.2; RF-17.
 *
 * sharp TRANSFORMA, no almacena: de acá salen tres buffers WEBP en memoria y
 * nada toca el disco. El original no se guarda ni se sirve nunca.
 *
 * Se convierte al subir y no al servir (§9.0): transformar sobre la marcha
 * obligaría a conservar el archivo de 8 MB, que es justamente lo que se
 * quiere evitar.
 */

export type Version = {
  sufijo: Sufijo;
  cuerpo: Buffer;
  ancho: number;
  alto: number;
  bytes: number;
};

export type ImagenProcesada = {
  versiones: Version[];
  /** Los del tamaño mayor: es el que ve el comprador en la ficha (§9.2). */
  ancho: number;
  alto: number;
  bytes: number;
};

export async function procesarImagen(entrada: Buffer): Promise<ImagenProcesada> {
  validarArchivo(entrada);

  // Segunda puerta, después de los magic bytes: un archivo con la firma
  // correcta y el contenido corrupto pasa la primera y muere acá. Mejor un
  // mensaje claro que una excepción de la biblioteca a mitad de camino.
  let original;
  try {
    original = await sharp(entrada).metadata();
  } catch {
    original = null;
  }

  if (!original?.width || !original.height) {
    throw domainError("VALIDATION", {
      message: "No pudimos leer esa imagen. Puede estar dañada.",
    });
  }

  const versiones = await Promise.all(
    TAMANOS.map(async ({ sufijo, ancho, calidad }) => {
      // `autoOrient` aplica la orientación del EXIF ANTES de redimensionar:
      // una foto sacada con el teléfono de costado se guarda derecha. Es el
      // único dato del EXIF que sobrevive — al no llamar a `keepMetadata`,
      // sharp descarta el resto, y ahí viven la marca del teléfono y las
      // coordenadas de dónde se sacó la foto (§9.2, §16).
      const { data, info } = await sharp(entrada)
        .autoOrient()
        .resize({ width: ancho, fit: "inside", withoutEnlargement: true })
        .webp({ quality: calidad })
        .toBuffer({ resolveWithObject: true });

      return {
        sufijo,
        cuerpo: data,
        // Del resultado, no del cálculo: con `withoutEnlargement` una imagen
        // de 300px de ancho sale de 300px en los tres tamaños, y suponer 1400
        // dejaría la base mintiendo sobre lo que hay en Storage.
        ancho: info.width,
        alto: info.height,
        bytes: info.size,
      };
    }),
  );

  const mayor = versiones.find((v) => v.sufijo === SUFIJO_MAYOR)!;

  return {
    versiones,
    ancho: mayor.ancho,
    alto: mayor.alto,
    bytes: mayor.bytes,
  };
}
