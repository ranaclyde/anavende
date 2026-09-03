import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { brands, variantImages } from "@/db/schema/catalog";
import { domainError } from "@/lib/errors";
import { almacenamiento } from "@/lib/storage";
import { procesarImagen } from "@/modules/media/procesar";
import {
  claveBase,
  claveDeLogo,
  clave,
  MAXIMO_POR_VARIANTE,
  TAMANOS,
  TAMANOS_LOGO,
  type Tamano,
} from "@/modules/media/tamanos";

/**
 * Sube todas las versiones y, si alguna falla, borra las que ya habían
 * subido. Devuelve las claves subidas para que quien llama pueda limpiarlas
 * si lo que falla es lo que viene DESPUÉS —el INSERT o el UPDATE—.
 */
async function subirVersiones(
  base: string,
  versiones: { sufijo: string; cuerpo: Buffer }[],
): Promise<string[]> {
  const store = almacenamiento();
  const subidas: string[] = [];

  try {
    for (const v of versiones) {
      const key = clave(base, v.sufijo);
      await store.put(key, v.cuerpo, "image/webp");
      subidas.push(key);
    }
    return subidas;
  } catch (e) {
    await borrarClaves(subidas);
    throw e;
  }
}

/**
 * Borra sin quejarse. Se usa en los caminos de limpieza, donde la excepción
 * que importa es otra: perder el archivo es peor que perder el motivo.
 */
async function borrarClaves(claves: string[]): Promise<void> {
  const store = almacenamiento();
  await Promise.all(claves.map((k) => store.delete(k).catch(() => {})));
}

/** Las claves de todas las versiones de una base, según su tabla de tamaños. */
function clavesDe(base: string, tamanos: readonly Tamano[]): string[] {
  return tamanos.map((t) => clave(base, t.sufijo));
}

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

  const subidas = await subirVersiones(base, procesada.versiones);

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
    await borrarClaves(subidas);
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

  // La fila ya no está, así que la vendedora ya no ve la imagen. Si algún
  // archivo sobrevive es basura, no una falla que valga cortar la operación y
  // mostrarle un error a alguien que hizo lo correcto.
  await borrarClaves(clavesDe(fila.storageKey, TAMANOS));
}

/** La URL pública de un tamaño concreto (§9.3). */
export function urlDeImagen(storageKey: string, sufijo: string): string {
  return almacenamiento().publicUrl(clave(storageKey, sufijo));
}

// ── Logo de marca (RF-18) ───────────────────────────────────────────────
//
// Se parece a la imagen de variante y no es igual, por dos motivos que se
// notan en el código:
//
//   · Es UNO por marca, así que vive en una columna y no en una tabla. No hay
//     orden, no hay tope, no hay id propio que devolver.
//   · Poner un logo nuevo REEMPLAZA al anterior, y el anterior hay que
//     borrarlo. Es la diferencia que más fácil se olvida: sin eso, cada
//     corrección de logo deja un juego de archivos que nadie muestra y nadie
//     encuentra.

export async function publicarLogoDeMarca({
  brandId,
  archivo,
}: {
  brandId: string;
  archivo: Buffer;
}): Promise<{ logoKey: string }> {
  const [marca] = await db
    .select({ logoKey: brands.logoKey })
    .from(brands)
    .where(eq(brands.id, brandId));

  if (!marca) throw domainError("NOT_FOUND");

  const procesada = await procesarImagen(archivo, TAMANOS_LOGO);

  const base = claveDeLogo(brandId, crypto.randomUUID());
  const subidas = await subirVersiones(base, procesada.versiones);

  try {
    await db
      .update(brands)
      .set({ logoKey: base, updatedAt: new Date() })
      .where(eq(brands.id, brandId));
  } catch (e) {
    await borrarClaves(subidas);
    throw e;
  }

  // Recién ahora: el anterior se borra DESPUÉS de que la fila apunte al
  // nuevo. Al revés, un fallo entre medio dejaría a la marca apuntando a
  // archivos borrados —un logo roto en el panel—, que es peor que un archivo
  // de más durante unos milisegundos.
  if (marca.logoKey) {
    await borrarClaves(clavesDe(marca.logoKey, TAMANOS_LOGO));
  }

  return { logoKey: base };
}

/**
 * Quitar el logo: la marca se queda sin él y los archivos se van (RF-18).
 *
 * La clave se lee ANTES del UPDATE. Pedirla con `returning` devolvería el
 * valor nuevo —`null`, que es justo el que se acaba de escribir— y los
 * archivos quedarían en Storage sin nada que los nombre.
 */
export async function quitarLogoDeMarca(brandId: string): Promise<void> {
  const [marca] = await db
    .select({ logoKey: brands.logoKey })
    .from(brands)
    .where(eq(brands.id, brandId));

  if (!marca) throw domainError("NOT_FOUND");
  if (!marca.logoKey) return;

  await db
    .update(brands)
    .set({ logoKey: null, updatedAt: new Date() })
    .where(eq(brands.id, brandId));

  await borrarClaves(clavesDe(marca.logoKey, TAMANOS_LOGO));
}

/**
 * Los archivos del logo de una marca, para borrarlos cuando se borra la marca
 * entera. Se lee ANTES del DELETE: después la fila ya no está y la clave se
 * perdió con ella.
 */
export async function clavesDelLogo(brandId: string): Promise<string[]> {
  const [marca] = await db
    .select({ logoKey: brands.logoKey })
    .from(brands)
    .where(eq(brands.id, brandId));

  return marca?.logoKey ? clavesDe(marca.logoKey, TAMANOS_LOGO) : [];
}

/** Borra archivos sueltos de Storage. Para los caminos de limpieza. */
export async function borrarArchivos(claves: string[]): Promise<void> {
  await borrarClaves(claves);
}

/** La URL del logo, en el tamaño pedido. `null` si la marca no tiene. */
export function urlDeLogo(
  logoKey: string | null,
  sufijo: "thumb" | "card" = "thumb",
): string | null {
  return logoKey ? almacenamiento().publicUrl(clave(logoKey, sufijo)) : null;
}

/** Las imágenes de una variante, en su orden (§9.5 resuelve el reenvío). */
export async function imagenesDeVariante(variantId: string) {
  return db
    .select()
    .from(variantImages)
    .where(and(eq(variantImages.variantId, variantId)))
    .orderBy(variantImages.sortOrder);
}
