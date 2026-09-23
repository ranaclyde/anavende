import "server-only";

import sharp from "sharp";

import { domainError } from "@/lib/errors";
import { TAMANOS, type Tamano } from "@/modules/media/tamanos";
import { validarArchivo } from "@/modules/media/validar";

/**
 * Conversión y redimensionado — TECHNICAL-SPEC §9.0, §9.2; RF-17.
 *
 * sharp TRANSFORMA, no almacena: de acá salen cuatro buffers en memoria —tres
 * WEBP para la pantalla y un JPEG para la vista previa al compartir (F3.9)— y
 * nada toca el disco. El original no se guarda ni se sirve nunca.
 *
 * Se convierte al subir y no al servir (§9.0): transformar sobre la marcha
 * obligaría a conservar el archivo de 8 MB, que es justamente lo que se
 * quiere evitar.
 */

/**
 * El mismo `--brand` de DESIGN-REFERENCE §3.1 que usa la tarjeta de marca
 * (`scripts/derivar-og.mts`). Que las dos vistas previas —la del sitio y la
 * de una ficha— compartan fondo es lo que hace que se lean como del mismo
 * lugar cuando caen una debajo de la otra en un chat.
 */
const FONDO_OG = { r: 0x83, g: 0x28, b: 0x33, alpha: 1 };

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
    tamanos.map(async ({ sufijo, ancho, alto, calidad, formato }) => {
      // `autoOrient` aplica la orientación del EXIF ANTES de redimensionar:
      // una foto sacada con el teléfono de costado se guarda derecha. Es el
      // único dato del EXIF que sobrevive — al no llamar a `keepMetadata`,
      // sharp descarta el resto, y ahí viven la marca del teléfono y las
      // coordenadas de dónde se sacó la foto (§9.2, §16).
      const recortada = sharp(entrada)
        .autoOrient()
        .resize(
          alto
            ? // La versión de Open Graph va a un lienzo FIJO de 1200×630: es
              // la proporción que todos recortan igual, y una foto cuadrada
              // metida ahí sin relleno saldría cortada de arriba y de abajo.
              // `contain` la deja entera y centrada sobre el burdeos, igual
              // que la tarjeta de marca de `scripts/derivar-og.mts`.
              {
                width: ancho,
                height: alto,
                fit: "contain",
                background: FONDO_OG,
                withoutEnlargement: true,
              }
            : { width: ancho, fit: "inside", withoutEnlargement: true },
        );

      const { data, info } = await (
        formato === "jpeg"
          ? // Sin canal alfa: un PNG con fondo transparente sale sobre el
            // burdeos y no sobre negro, que es a lo que cae JPEG solo.
            recortada
              .flatten({ background: FONDO_OG })
              .jpeg({ quality: calidad })
          : recortada.webp({ quality: calidad })
      ).toBuffer({ resolveWithObject: true });

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
  //
  // **Pero las de lienzo fijo no juegan**, y esto es lo que se llevó puesto
  // agregar la versión `og` de F3.9: su lienzo mide 1200×630 aunque la foto
  // que lleva adentro sea de 300px, así que una foto chica la habría
  // convertido en «la más grande» y `variant_images` habría guardado 1200×630
  // como medidas de una imagen de 300×200. La galería habría reservado un
  // lugar que la foto no ocupa.
  //
  // El respaldo de abajo tampoco es por las dudas:
  // `scripts/derivar-og-productos.mts` llama con `TAMANOS_OG` sola —solo
  // quiere rehacer esa versión— y ahí NO hay ninguna de galería. Sin él,
  // reducir un arreglo vacío revienta.
  const deGaleria = new Set(
    tamanos.filter((t) => !t.alto).map((t) => t.sufijo),
  );
  const candidatas = versiones.filter((v) => deGaleria.has(v.sufijo));
  const mayor = (candidatas.length > 0 ? candidatas : versiones).reduce(
    (a, b) => (b.ancho > a.ancho ? b : a),
  );

  return {
    versiones,
    ancho: mayor.ancho,
    alto: mayor.alto,
    bytes: mayor.bytes,
  };
}
