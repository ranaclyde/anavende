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
import { getStorage } from "@/lib/storage";
import type { Capa, CapaLista } from "@/modules/media/marca-de-agua";
import { MAXIMO_DE_CAPAS } from "@/modules/media/marca-de-agua";
import { clave } from "@/modules/media/tamanos";
import { validarArchivo } from "@/modules/media/validar";

// La composición vive en `modules/media/marca-de-agua.ts`; esto guarda, lee y
// entrega las capas (TECHNICAL-SPEC §9.6).

export const SUFIJO_DE_MARCA = "marca";

const ANCHO_MAXIMO = 2000;

export function claveDeMarcaDeAgua(imageId: string): string {
  return `marcas-de-agua/${imageId}`;
}

export function archivoDeMarca(base: string): string {
  return clave(base, SUFIJO_DE_MARCA);
}

/**
 * Se puede recordar sin invalidar: la clave lleva un UUID por imagen y una
 * imagen de la biblioteca no se reemplaza nunca.
 */
const recordadas = new Map<string, Buffer>();
const TOPE_RECORDADAS = 8;

async function bytesDe(storageKey: string): Promise<Buffer> {
  const ya = recordadas.get(storageKey);
  if (ya) return ya;

  const bytes = await getStorage().get(archivoDeMarca(storageKey));
  if (recordadas.size >= TOPE_RECORDADAS) {
    recordadas.delete(recordadas.keys().next().value!);
  }
  recordadas.set(storageKey, bytes);
  return bytes;
}

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

/** Prender sin capas no se puede: diría «activada» y las fotos saldrían limpias. */
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

export type ImagenDeMarca = {
  id: string;
  storageKey: string;
  name: string;
  width: number;
  height: number;
};

/** Solo PNG o WEBP: un JPG no tiene transparencia y taparía la foto. */
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
  const store = getStorage();
  await store.put(archivoDeMarca(base), resultado.data, "image/webp");

  try {
    const [fila] = await db
      .insert(watermarkImages)
      .values({
        id,
        storageKey: base,
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
 * Se lleva sus capas (`ON DELETE CASCADE`); si no queda ninguna, la marca se
 * apaga. Devuelve si se apagó.
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

  // Después de la fila (§9.1): un archivo de más es basura; una fila sin
  // archivo es una capa rota.
  await getStorage()
    .delete(archivoDeMarca(resultado.storageKey))
    .catch(() => {});
  recordadas.delete(resultado.storageKey);

  return { seApago: resultado.seApago };
}

export type CapaGuardada = Capa & { imageId: string };

/** Llega la lista completa y reemplaza todas las capas. Sin capas, la marca se apaga. */
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

/** Recibe la lista y no la lee porque la vista previa manda capas sin guardar. */
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

/** Se lee en cada subida: un cambio surte efecto en la siguiente sin invalidar nada. */
export async function marcaParaSubir(): Promise<CapaLista[]> {
  if (!(await estaActiva())) return [];
  return prepararCapas(await leerCapas());
}
