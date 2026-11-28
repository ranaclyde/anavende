import "server-only";

import sharp from "sharp";

import { domainError } from "@/lib/errors";
import { ponerMarca, type CapaLista } from "@/modules/media/marca-de-agua";
import {
  SUFIJOS_CON_MARCA,
  TAMANOS,
  type Tamano,
} from "@/modules/media/tamanos";
import { validarArchivo } from "@/modules/media/validar";

// Se convierte al subir y no al servir (TECHNICAL-SPEC §9.0): el original no
// se guarda ni se sirve nunca.

/** El `--brand` de DESIGN-REFERENCE §3.1, el mismo fondo de `scripts/derivar-og.mts`. */
const FONDO_OG = { r: 0x83, g: 0x28, b: 0x33, alpha: 1 };

/**
 * Para la memoria del servidor (TECHNICAL-SPEC R3). Vale para todo el proceso:
 * `/_next/image` usa el mismo sharp, y `next.config.ts` le pide lo mismo
 * (`imgOptConcurrency`, `imgOptOperationCache`) o pisaría estos valores.
 * La otra mitad es `MALLOC_ARENA_MAX=2` en el `Dockerfile`.
 */
sharp.concurrency(1);
sharp.cache(false);

export type Version = {
  sufijo: string;
  cuerpo: Buffer;
  ancho: number;
  alto: number;
  bytes: number;
};

export type ImagenProcesada = {
  versiones: Version[];
  /** Los de la versión de galería más ancha. */
  ancho: number;
  alto: number;
  bytes: number;
};

export async function procesarImagen(
  entrada: Buffer,
  tamanos: readonly Tamano[] = TAMANOS,
  /** Solo las fotos de producto; se aplica a `SUFIJOS_CON_MARCA`. */
  marca: readonly CapaLista[] = [],
): Promise<ImagenProcesada> {
  validarArchivo(entrada);

  // Segunda puerta, después de los magic bytes: firma correcta y contenido
  // corrupto mueren acá con un mensaje claro.
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

  // Una versión tras otra: cada una lee el original entero, y en paralelo el
  // pico de memoria se multiplica.
  const versiones: Version[] = [];
  for (const { sufijo, ancho, alto, calidad, formato, cuadrado } of tamanos) {
    // `autoOrient` antes de redimensionar. Sin `keepMetadata`, sharp descarta
    // el resto del EXIF, incluidas las coordenadas (§16).
    const recortada = sharp(entrada)
      .autoOrient()
      .resize(
        alto
          ? // `og`: lienzo fijo; `contain` deja la foto entera sobre el burdeos.
            {
              width: ancho,
              height: alto,
              fit: "contain",
              background: FONDO_OG,
              withoutEnlargement: true,
            }
          : cuadrado
            ? // `attention` suele encontrar la cara; centrado, un retrato
              // vertical perdía la frente. Sin `withoutEnlargement`: una foto
              // de menos de 256px saldría con su proporción y el círculo la
              // deformaría.
              {
                width: ancho,
                height: ancho,
                fit: "cover",
                position: sharp.strategy.attention,
              }
            : { width: ancho, fit: "inside", withoutEnlargement: true },
      );

    // Con marca, primero a píxeles crudos: el tamaño de cada capa sale del
    // tamaño final.
    const conMarca =
      marca.length > 0 && formato !== "jpeg" && SUFIJOS_CON_MARCA.has(sufijo);
    const lista = conMarca
      ? await ponerMarca(
          await recortada.raw().toBuffer({ resolveWithObject: true }),
          marca,
        )
      : recortada;

    const { data, info } = await (
      formato === "jpeg"
        ? // Sin aplanar, JPEG pone negro donde había transparencia.
          lista.flatten({ background: FONDO_OG }).jpeg({ quality: calidad })
        : lista.webp({ quality: calidad })
    ).toBuffer({ resolveWithObject: true });

    versiones.push({
      sufijo,
      cuerpo: data,
      // Del resultado, no del cálculo: con `withoutEnlargement` puede ser más chica.
      ancho: info.width,
      alto: info.height,
      bytes: info.size,
    });
  }

  // Las de lienzo fijo (`og`) no cuentan: con una foto chica, 1200×630 pasaría
  // por la más grande. El respaldo no sobra: si se piden solo versiones de
  // lienzo fijo no hay ninguna de galería, y reducir un arreglo vacío revienta.
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
