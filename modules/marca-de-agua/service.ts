import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import {
  watermarkImages,
  watermarkLayers,
  watermarkSettings,
} from "@/db/schema/settings";
import { domainError } from "@/lib/errors";
import { almacenamiento } from "@/lib/storage";
import type { Capa, CapaLista } from "@/modules/media/marca-de-agua";
import { MAXIMO_DE_CAPAS } from "@/modules/media/marca-de-agua";
import { clave } from "@/modules/media/tamanos";
import { validarArchivo } from "@/modules/media/validar";

/**
 * La marca de agua del lado de la base y de Storage — RF-39, TS §9.6.
 *
 * La composición vive en `modules/media/marca-de-agua.ts` y no sabe de dónde
 * salen las capas; esto es lo que las guarda, las lee y las entrega listas.
 */

/** La única versión de cada imagen de la biblioteca: `…/{id}-marca.webp`. */
export const SUFIJO_DE_MARCA = "marca";

/** Las imágenes se guardan a este ancho como mucho (§9.6). */
const ANCHO_MAXIMO = 2000;

/** `marcas-de-agua/{imageId}` — la base, sin sufijo (§9.2). */
export function claveDeMarcaDeAgua(imageId: string): string {
  return `marcas-de-agua/${imageId}`;
}

export function archivoDeMarca(base: string): string {
  return clave(base, SUFIJO_DE_MARCA);
}

/* ── Lectura de las imágenes, con memoria ─────────────────────────────── */

/**
 * Los bytes de las imágenes ya leídas de Storage, por clave.
 *
 * **Se pueden recordar sin miedo**: la clave lleva un UUID nuevo por imagen y
 * una imagen de la biblioteca no se reemplaza nunca, así que lo que está
 * bajo una clave no cambia. Cargar un producto con cinco fotos por color
 * lee la marca una vez y no quince. Tope chico: son cuatro capas como mucho.
 */
const recordadas = new Map<string, Buffer>();
const TOPE_RECORDADAS = 8;

async function bytesDe(storageKey: string): Promise<Buffer> {
  const ya = recordadas.get(storageKey);
  if (ya) return ya;

  const bytes = await almacenamiento().get(archivoDeMarca(storageKey));
  if (recordadas.size >= TOPE_RECORDADAS) {
    recordadas.delete(recordadas.keys().next().value!);
  }
  recordadas.set(storageKey, bytes);
  return bytes;
}

/* ── Interruptor ──────────────────────────────────────────────────────── */

/** Sin fila, la marca está apagada (§5.9). */
export async function estaActiva(): Promise<boolean> {
  const [fila] = await db
    .select({ enabled: watermarkSettings.enabled })
    .from(watermarkSettings)
    .where(eq(watermarkSettings.id, 1));
  return fila?.enabled ?? false;
}

async function escribirActiva(activa: boolean): Promise<void> {
  await db.execute(sql`
    INSERT INTO watermark_settings (id, enabled, updated_at)
    VALUES (1, ${activa}, now())
    ON CONFLICT (id) DO UPDATE
      SET enabled = EXCLUDED.enabled, updated_at = now()`);
}

/**
 * Prender o apagar. **Prender sin capas no se puede** (RF-39): el panel diría
 * «activada» y las fotos saldrían limpias.
 */
export async function activarMarca(activa: boolean): Promise<boolean> {
  if (activa) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(watermarkLayers);
    if (n === 0) {
      throw domainError("VALIDATION", {
        message: "Armá al menos una capa antes de activar la marca de agua.",
      });
    }
  }
  await escribirActiva(activa);
  return activa;
}

/* ── Biblioteca ───────────────────────────────────────────────────────── */

export type ImagenDeMarca = {
  id: string;
  storageKey: string;
  name: string;
  width: number;
  height: number;
};

/**
 * Subir una imagen a la biblioteca. **Solo PNG o WEBP**: son los que guardan
 * la transparencia, y una marca en JPG sería un recuadro blanco tapando la
 * foto. Se guarda una sola vez, en WEBP sin pérdida (§9.6).
 */
export async function subirImagenDeMarca(
  archivo: Buffer,
  nombre: string,
): Promise<ImagenDeMarca> {
  const tipo = validarArchivo(archivo);
  if (tipo === "image/jpeg") {
    throw domainError("VALIDATION", {
      message:
        "La marca de agua necesita fondo transparente, y un JPG no lo tiene. Subila en PNG.",
    });
  }

  let resultado;
  try {
    resultado = await sharp(archivo)
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .webp({ lossless: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw domainError("VALIDATION", {
      message: "No pudimos leer esa imagen. Puede estar dañada.",
    });
  }

  const id = crypto.randomUUID();
  const base = claveDeMarcaDeAgua(id);
  const store = almacenamiento();
  await store.put(archivoDeMarca(base), resultado.data, "image/webp");

  try {
    const [fila] = await db
      .insert(watermarkImages)
      .values({
        id,
        storageKey: base,
        // El nombre es para reconocerla en la lista, no un dato: se corta
        // y se le saca la extensión.
        name:
          nombre
            .replace(/\.[a-z0-9]+$/i, "")
            .trim()
            .slice(0, 80) || "Marca de agua",
        width: resultado.info.width,
        height: resultado.info.height,
      })
      .returning();
    return fila;
  } catch (e) {
    await store.delete(archivoDeMarca(base)).catch(() => {});
    throw e;
  }
}

/**
 * Borrar una imagen de la biblioteca. Se lleva sus capas (`ON DELETE
 * CASCADE`); si con eso no queda ninguna, la marca se apaga —prendida y sin
 * capas diría «activada» sin poner nada—. Devuelve si se apagó.
 */
export async function borrarImagenDeMarca(
  id: string,
): Promise<{ seApago: boolean }> {
  const resultado = await db.transaction(async (tx) => {
    const [fila] = await tx
      .delete(watermarkImages)
      .where(eq(watermarkImages.id, id))
      .returning({ storageKey: watermarkImages.storageKey });
    if (!fila) throw domainError("NOT_FOUND");

    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(watermarkLayers);
    let seApago = false;
    if (n === 0) {
      const apagadas = await tx.execute(sql`
        UPDATE watermark_settings SET enabled = false, updated_at = now()
         WHERE id = 1 AND enabled`);
      seApago = (apagadas as unknown as { count: number }).count > 0;
    }
    return { storageKey: fila.storageKey, seApago };
  });

  // Después de la fila, como en el resto (§9.1): un archivo de más es
  // basura; una fila sin archivo es una capa rota.
  await almacenamiento()
    .delete(archivoDeMarca(resultado.storageKey))
    .catch(() => {});
  recordadas.delete(resultado.storageKey);

  return { seApago: resultado.seApago };
}

/* ── Capas ────────────────────────────────────────────────────────────── */

export type CapaGuardada = Capa & { imageId: string };

/**
 * Reemplaza todas las capas por las que llegan, en ese orden. Llega la lista
 * COMPLETA, como el orden de las fotos: se guarda lo que se ve en pantalla.
 * Sin capas, la marca se apaga.
 */
export async function guardarCapas(
  capas: readonly CapaGuardada[],
): Promise<{ seApago: boolean }> {
  if (capas.length > MAXIMO_DE_CAPAS) {
    throw domainError("VALIDATION", {
      message: `Entran hasta ${MAXIMO_DE_CAPAS} capas.`,
    });
  }

  return db.transaction(async (tx) => {
    if (capas.length > 0) {
      const ids = [...new Set(capas.map((c) => c.imageId))];
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(watermarkImages)
        .where(inArray(watermarkImages.id, ids));
      if (n !== ids.length) {
        throw domainError("VALIDATION", {
          message:
            "Una de las imágenes ya no está en la biblioteca. Actualizá la página y probá de nuevo.",
        });
      }
    }

    await tx.delete(watermarkLayers);
    if (capas.length > 0) {
      await tx.insert(watermarkLayers).values(
        capas.map((c, i) => ({
          imageId: c.imageId,
          mode: c.mode,
          anchor: c.anchor,
          sizePct: c.sizePct,
          marginPct: c.marginPct,
          opacityPct: c.opacityPct,
          sortOrder: i,
        })),
      );
      return { seApago: false };
    }

    const apagadas = await tx.execute(sql`
      UPDATE watermark_settings SET enabled = false, updated_at = now()
       WHERE id = 1 AND enabled`);
    return { seApago: (apagadas as unknown as { count: number }).count > 0 };
  });
}

/* ── Lo que usa la subida y la vista previa ───────────────────────────── */

/**
 * Las capas con los bytes de su imagen, para `procesarImagen`. Sirve también
 * para la vista previa, que manda capas sin guardar: por eso recibe la lista
 * y no la lee.
 */
export async function prepararCapas(
  capas: readonly CapaGuardada[],
): Promise<CapaLista[]> {
  if (capas.length === 0) return [];

  const ids = [...new Set(capas.map((c) => c.imageId))];
  const imagenes = await db
    .select({ id: watermarkImages.id, storageKey: watermarkImages.storageKey })
    .from(watermarkImages)
    .where(inArray(watermarkImages.id, ids));
  const claves = new Map(imagenes.map((i) => [i.id, i.storageKey]));

  const listas: CapaLista[] = [];
  for (const c of capas) {
    const storageKey = claves.get(c.imageId);
    if (!storageKey) {
      throw domainError("VALIDATION", {
        message:
          "Una de las imágenes ya no está en la biblioteca. Actualizá la página y probá de nuevo.",
      });
    }
    listas.push({
      mode: c.mode,
      anchor: c.anchor,
      sizePct: c.sizePct,
      marginPct: c.marginPct,
      opacityPct: c.opacityPct,
      imagen: await bytesDe(storageKey),
    });
  }
  return listas;
}

export async function leerCapas(): Promise<CapaGuardada[]> {
  return db
    .select({
      imageId: watermarkLayers.imageId,
      mode: watermarkLayers.mode,
      anchor: watermarkLayers.anchor,
      sizePct: watermarkLayers.sizePct,
      marginPct: watermarkLayers.marginPct,
      opacityPct: watermarkLayers.opacityPct,
    })
    .from(watermarkLayers)
    .orderBy(asc(watermarkLayers.sortOrder));
}

/**
 * La marca que lleva una foto que se sube AHORA: sus capas si está activa, o
 * ninguna. Se lee en cada subida (§9.6): prenderla o cambiarla surte efecto
 * en la siguiente, sin nada que invalidar.
 */
export async function marcaParaSubir(): Promise<CapaLista[]> {
  if (!(await estaActiva())) return [];
  return prepararCapas(await leerCapas());
}
