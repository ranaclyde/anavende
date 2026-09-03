import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { variantImages } from "@/db/schema/catalog";
import { domainError } from "@/lib/errors";
import { almacenamiento } from "@/lib/storage";
import { procesarImagen } from "@/modules/media/procesar";
import {
  claveBase,
  clave,
  MAXIMO_POR_VARIANTE,
  type Sufijo,
} from "@/modules/media/tamanos";

/**
 * Publicación de una imagen de variante — TECHNICAL-SPEC §9.1; RF-17.
 *
 * El proceso es SÍNCRONO: cuando esta función vuelve, o la imagen está
 * entera en Storage y en la base, o no quedó nada de ella en ningún lado. No
 * existe el estado «procesando», y por eso tampoco existe la pantalla que
 * habría que dibujar para explicarlo.
 *
 * **Lo que se cuida es que no queden huérfanos.** Hay dos formas de terminar
 * a medias y las dos se limpian:
 *
 *   · Falla la subida del segundo o del tercer tamaño → se borran los que ya
 *     habían subido.
 *   · Suben los tres y falla el INSERT → se borran los tres. Un archivo en
 *     Storage sin fila que lo nombre no lo encuentra nadie y no lo borra
 *     nadie: ocupa lugar para siempre.
 *
 * Si la limpieza también falla, gana el error original: es el que explica qué
 * pasó. El fallo de la limpieza se registra aparte.
 */

export type ImagenPublicada = {
  id: string;
  storageKey: string;
  ancho: number;
  alto: number;
  bytes: number;
  sortOrder: number;
};

export async function publicarImagenDeVariante({
  productId,
  variantId,
  archivo,
  altText,
}: {
  productId: string;
  variantId: string;
  archivo: Buffer;
  altText?: string | null;
}): Promise<ImagenPublicada> {
  // El tope se comprueba ANTES de convertir: procesar tres tamaños para
  // después decir que no entraba es trabajo tirado, y en una imagen de 8 MB
  // no es trabajo despreciable.
  const [conteo] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(variantImages)
    .where(eq(variantImages.variantId, variantId));

  if ((conteo?.n ?? 0) >= MAXIMO_POR_VARIANTE) {
    throw domainError("VALIDATION", {
      message: `Esa variante ya tiene ${MAXIMO_POR_VARIANTE} imágenes, que son las que entran. Borrá una para subir otra.`,
    });
  }

  const procesada = await procesarImagen(archivo);

  // El id se genera acá y no lo devuelve la base: la clave de Storage lo
  // necesita antes de que exista la fila, y pedirle a Postgres un UUID suelto
  // para después usarlo sería una ida y vuelta de más.
  const imageId = crypto.randomUUID();
  const base = claveBase(productId, variantId, imageId);
  const store = almacenamiento();

  const subidas: string[] = [];

  const limpiar = async () => {
    for (const key of subidas) {
      try {
        await store.delete(key);
      } catch {
        // Se traga a propósito: la excepción que importa es la que trajo
        // hasta acá. Perder el archivo es peor que perder el motivo.
      }
    }
  };

  try {
    for (const version of procesada.versiones) {
      const key = clave(base, version.sufijo);
      await store.put(key, version.cuerpo, "image/webp");
      subidas.push(key);
    }
  } catch (e) {
    await limpiar();
    throw e;
  }

  try {
    const [fila] = await db
      .insert(variantImages)
      .values({
        variantId,
        storageKey: base,
        altText: altText ?? null,
        width: procesada.ancho,
        height: procesada.alto,
        bytes: procesada.bytes,
        // Se agrega al final. Reordenar es una acción aparte (RF-17), no un
        // efecto de subir.
        sortOrder: conteo?.n ?? 0,
      })
      .returning();

    return {
      id: fila.id,
      storageKey: fila.storageKey,
      ancho: fila.width,
      alto: fila.height,
      bytes: fila.bytes,
      sortOrder: fila.sortOrder,
    };
  } catch (e) {
    await limpiar();
    throw e;
  }
}

/**
 * RF-17: eliminar una imagen la quita del almacenamiento, no solo del
 * listado. Primero se borra la fila y después los archivos: al revés, un
 * fallo entre medio dejaría una fila apuntando a archivos que ya no están
 * —una imagen rota en la ficha—, que es peor que un archivo que nadie mira.
 */
export async function borrarImagenDeVariante(imageId: string): Promise<void> {
  const [fila] = await db
    .delete(variantImages)
    .where(eq(variantImages.id, imageId))
    .returning({ storageKey: variantImages.storageKey });

  if (!fila) throw domainError("NOT_FOUND");

  const store = almacenamiento();
  const sufijos: Sufijo[] = ["thumb", "card", "detail"];

  await Promise.all(
    sufijos.map((s) =>
      store.delete(clave(fila.storageKey, s)).catch(() => {
        // Ídem: la fila ya no está, la vendedora ya no ve la imagen. Un
        // archivo que sobrevive es basura, no una falla que valga cortar la
        // operación y mostrarle un error a alguien que hizo lo correcto.
      }),
    ),
  );
}

/** La URL pública de un tamaño concreto (§9.3). */
export function urlDeImagen(storageKey: string, sufijo: Sufijo): string {
  return almacenamiento().publicUrl(clave(storageKey, sufijo));
}

/** Las imágenes de una variante, en su orden (§9.5 resuelve el reenvío). */
export async function imagenesDeVariante(variantId: string) {
  return db
    .select()
    .from(variantImages)
    .where(and(eq(variantImages.variantId, variantId)))
    .orderBy(variantImages.sortOrder);
}
