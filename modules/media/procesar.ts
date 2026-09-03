import "server-only";

import sharp from "sharp";

import { domainError } from "@/lib/errors";
import { TAMANOS, type Tamano } from "@/modules/media/tamanos";
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
  sufijo: string;
  cuerpo: Buffer;
  ancho: number;
  alto: number;
  bytes: number;
};

export type ImagenProcesada = {
  versiones: Version[];
  /** Los del tamaño mayor de la tabla que se haya usado (§9.2). */
  ancho: number;
  alto: number;
  bytes: number;
};

/**
 * `tamanos` se pasa porque no toda imagen quiere los mismos: el logo de marca
 * usa dos y no tres (§9.2). Lo que NO cambia con el destino es todo lo demás
 * —validación, orientación, WEBP, descarte del EXIF—, y por eso vive acá una
 * sola vez.
 */
export async function procesarImagen(
  entrada: Buffer,
  tamanos: readonly Tamano[] = TAMANOS,
): Promise<ImagenProcesada> {
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
    tamanos.map(async ({ sufijo, ancho, calidad }) => {
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

  // El mayor se busca por ancho y no por un sufijo fijo: con dos tablas de
  // tamaños distintas, «el más grande» no siempre se llama igual.
  const mayor = versiones.reduce((a, b) => (b.ancho > a.ancho ? b : a));

  return {
    versiones,
    ancho: mayor.ancho,
    alto: mayor.alto,
    bytes: mayor.bytes,
  };
}
