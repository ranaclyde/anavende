import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  brands,
  categories,
  productVariants,
  variantImages,
} from "@/db/schema/catalog";
import { paymentMethods } from "@/db/schema/settings";
import { userProfiles } from "@/db/schema/users";
import { domainError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { marcaParaSubir } from "@/modules/marca-de-agua/service";
import { procesarImagen } from "@/modules/media/procesar";
import {
  claveBase,
  claveDeFotoDePerfil,
  claveDeLogo,
  clave,
  MAXIMO_POR_VARIANTE,
  TAMANOS,
  TAMANOS_LOGO,
  TAMANOS_PERFIL,
  tipoDe,
  type DestinoDeLogo,
  type Tamano,
} from "@/modules/media/tamanos";

/**
 * Si una versión falla, borra las ya subidas. Devuelve las claves para que
 * quien llama las limpie si falla lo que viene después.
 */
async function subirVersiones(
  base: string,
  versiones: { sufijo: string; cuerpo: Buffer }[],
): Promise<string[]> {
  const store = getStorage();
  const subidas: string[] = [];

  try {
    for (const v of versiones) {
      const key = clave(base, v.sufijo);
      // El tipo sale de la tabla: un JPEG servido como `image/webp` es lo que
      // WhatsApp no dibuja.
      await store.put(key, v.cuerpo, tipoDe(v.sufijo));
      subidas.push(key);
    }
    return subidas;
  } catch (e) {
    await borrarClaves(subidas);
    throw e;
  }
}

/** Borra sin quejarse: en la limpieza, la excepción que importa es otra. */
async function borrarClaves(claves: string[]): Promise<void> {
  const store = getStorage();
  await Promise.all(claves.map((k) => store.delete(k).catch(() => {})));
}

function clavesDe(base: string, tamanos: readonly Tamano[]): string[] {
  return tamanos.map((t) => clave(base, t.sufijo));
}

/**
 * Síncrona (TECHNICAL-SPEC §9.1): al volver, la imagen está entera en Storage
 * y en la base, o no quedó nada. Si la limpieza falla, gana el error original.
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
  // Todo lo que hay que saber antes de convertir, para no procesar una foto
  // de 8 MB que después no entra.
  const [estado] = await db.execute<{
    productId: string;
    imagesSourceId: string | null;
    n: number;
  }>(sql`
    SELECT v.product_id        AS "productId",
           v.images_source_id  AS "imagesSourceId",
           count(i.id)::int    AS n
      FROM ${productVariants} v
      LEFT JOIN ${variantImages} i ON i.variant_id = v.id
     WHERE v.id = ${variantId}
     GROUP BY v.id`);

  if (!estado) throw domainError("NOT_FOUND");

  // El `productId` llega del formulario y arma la clave de Storage: sin esto,
  // el archivo quedaría en una carpeta donde nadie lo busca al borrar.
  if (estado.productId !== productId) {
    throw domainError("NOT_FOUND");
  }

  // Una variante que reutiliza las de otra no muestra las propias (§9.5).
  if (estado.imagesSourceId) {
    throw domainError("VALIDATION", {
      message:
        "Ese color usa las fotos de otro. Dejá de reutilizarlas para poder subirle las propias.",
    });
  }

  if (estado.n >= MAXIMO_POR_VARIANTE) {
    throw domainError("VALIDATION", {
      message: `Ese color ya tiene ${MAXIMO_POR_VARIANTE} fotos, que son las que entran. Borrá una para subir otra.`,
    });
  }

  const marca = await marcaParaSubir();
  const procesada = await procesarImagen(archivo, undefined, marca);

  // El id se genera acá porque la clave de Storage lo necesita antes de la fila.
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
        sortOrder: estado.n,
        hasWatermark: marca.length > 0,
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
 * No es cosmética: la próxima subida toma la cantidad como `sortOrder`, y con
 * huecos dos imágenes quedarían con el mismo número y la portada cambiaría sola.
 */
async function renumerar(variantId: string): Promise<void> {
  await db.execute(sql`
    WITH ordenadas AS (
      SELECT id,
             row_number() OVER (ORDER BY sort_order, created_at) - 1 AS n
        FROM ${variantImages}
       WHERE variant_id = ${variantId}
    )
    UPDATE ${variantImages} i
       SET sort_order = o.n
      FROM ordenadas o
     WHERE i.id = o.id AND i.sort_order <> o.n`);
}

/**
 * Primero la fila y después los archivos: al revés, un fallo en el medio
 * dejaría una imagen rota en la ficha.
 */
export async function borrarImagenDeVariante(imageId: string): Promise<void> {
  const [fila] = await db
    .delete(variantImages)
    .where(eq(variantImages.id, imageId))
    .returning({
      storageKey: variantImages.storageKey,
      variantId: variantImages.variantId,
    });

  if (!fila) throw domainError("NOT_FOUND");

  await renumerar(fila.variantId);

  // La fila ya no está: si algún archivo sobrevive es basura, no un error.
  await borrarClaves(clavesDe(fila.storageKey, TAMANOS));
}

/**
 * La principal es la de la posición 0 (TECHNICAL-SPEC §5.4). Llega el orden
 * completo: si no coincide con lo que hay en la base, se rechaza entero.
 */
export async function reordenarImagenesDeVariante(
  variantId: string,
  ids: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const actuales = await tx
      .select({ id: variantImages.id })
      .from(variantImages)
      .where(eq(variantImages.variantId, variantId));

    const enLaBase = new Set(actuales.map((f) => f.id));
    const pedidos = new Set(ids);

    if (
      enLaBase.size !== pedidos.size ||
      ids.length !== pedidos.size ||
      ids.some((id) => !enLaBase.has(id))
    ) {
      throw domainError("VALIDATION", {
        message:
          "Las imágenes cambiaron mientras las ordenabas. Actualizá la página y probá de nuevo.",
      });
    }

    // Una sentencia y no una por imagen, para no dejar la galería a medio
    // ordenar. Los ids van como parámetros aunque ya se comprobaron.
    const orden = sql.join(
      ids.map((id, i) => sql`(${id}::uuid, ${i}::int)`),
      sql`, `,
    );

    await tx.execute(sql`
      UPDATE ${variantImages} i
         SET sort_order = o.n
        FROM (VALUES ${orden}) AS o(id, n)
       WHERE i.id = o.id AND i.variant_id = ${variantId}`);
  });
}

/**
 * Se leen antes del DELETE: después `variant_images` cae por cascada y las
 * claves se van con ella.
 */
export async function clavesDeVariante(variantId: string): Promise<string[]> {
  const filas = await db
    .select({ storageKey: variantImages.storageKey })
    .from(variantImages)
    .where(eq(variantImages.variantId, variantId));

  return filas.flatMap((f) => clavesDe(f.storageKey, TAMANOS));
}

export async function clavesDeProducto(productId: string): Promise<string[]> {
  const filas = await db.execute<{ storageKey: string }>(sql`
    SELECT i.storage_key AS "storageKey"
      FROM ${variantImages} i
      JOIN ${productVariants} v ON v.id = i.variant_id
     WHERE v.product_id = ${productId}`);

  return filas.flatMap((f) => clavesDe(f.storageKey, TAMANOS));
}

export function urlDeImagen(storageKey: string, sufijo: string): string {
  return getStorage().publicUrl(clave(storageKey, sufijo));
}

/**
 * Desde el dominio de la tienda y no de Storage (TECHNICAL-SPEC §9.4): desde
 * Storage WhatsApp no la dibujaba. Relativa a propósito: la completa
 * `metadataBase`.
 */
export function rutaDeVistaPrevia(storageKey: string): string {
  return `/vista-previa/${clave(storageKey, "og")}`;
}

// Logos: marca, medio de pago e imagen de categoría. Uno por fila, en una
// columna, y el nuevo reemplaza y borra al anterior. Una sola implementación
// porque lo delicado es el orden: subir, apuntar la fila, recién ahí borrar.

const LOGOS: Record<
  DestinoDeLogo,
  {
    leer: (id: string) => Promise<string | null | undefined>;
    escribir: (id: string, logoKey: string | null) => Promise<boolean>;
  }
> = {
  marca: {
    leer: async (id) =>
      (
        await db
          .select({ logoKey: brands.logoKey })
          .from(brands)
          .where(eq(brands.id, id))
      )[0]?.logoKey,
    escribir: async (id, logoKey) =>
      (
        await db
          .update(brands)
          .set({ logoKey, updatedAt: new Date() })
          .where(eq(brands.id, id))
          .returning({ id: brands.id })
      ).length > 0,
  },
  "medio-de-pago": {
    leer: async (id) =>
      (
        await db
          .select({ logoKey: paymentMethods.logoKey })
          .from(paymentMethods)
          .where(eq(paymentMethods.id, id))
      )[0]?.logoKey,
    // `payment_methods` no tiene `updated_at` (§5.9).
    escribir: async (id, logoKey) =>
      (
        await db
          .update(paymentMethods)
          .set({ logoKey })
          .where(eq(paymentMethods.id, id))
          .returning({ id: paymentMethods.id })
      ).length > 0,
  },
  categoria: {
    leer: async (id) =>
      (
        await db
          .select({ imageKey: categories.imageKey })
          .from(categories)
          .where(eq(categories.id, id))
      )[0]?.imageKey,
    escribir: async (id, imageKey) =>
      (
        await db
          .update(categories)
          .set({ imageKey, updatedAt: new Date() })
          .where(eq(categories.id, id))
          .returning({ id: categories.id })
      ).length > 0,
  },
};

/** `undefined` = la fila no existe; `null` = existe y no tiene logo. */
async function claveActual(
  destino: DestinoDeLogo,
  id: string,
): Promise<string | null | undefined> {
  return LOGOS[destino].leer(id);
}

export async function publicarLogo({
  destino,
  id,
  archivo,
}: {
  destino: DestinoDeLogo;
  id: string;
  archivo: Buffer;
}): Promise<{ logoKey: string }> {
  const anterior = await claveActual(destino, id);
  if (anterior === undefined) throw domainError("NOT_FOUND");

  const procesada = await procesarImagen(archivo, TAMANOS_LOGO);

  const base = claveDeLogo(destino, id, crypto.randomUUID());
  const subidas = await subirVersiones(base, procesada.versiones);

  try {
    await LOGOS[destino].escribir(id, base);
  } catch (e) {
    await borrarClaves(subidas);
    throw e;
  }

  // El anterior se borra después de que la fila apunte al nuevo: al revés, un
  // fallo en el medio dejaría un logo roto.
  if (anterior) {
    await borrarClaves(clavesDe(anterior, TAMANOS_LOGO));
  }

  return { logoKey: base };
}

/**
 * La clave se lee antes del UPDATE: `returning` devolvería el valor nuevo,
 * `null`, y los archivos quedarían sin nada que los nombre.
 */
export async function quitarLogo(
  destino: DestinoDeLogo,
  id: string,
): Promise<void> {
  const anterior = await claveActual(destino, id);

  if (anterior === undefined) throw domainError("NOT_FOUND");
  if (!anterior) return;

  await LOGOS[destino].escribir(id, null);

  await borrarClaves(clavesDe(anterior, TAMANOS_LOGO));
}

/** Se leen antes del DELETE: después la clave se perdió con la fila. */
export async function clavesDelLogo(
  destino: DestinoDeLogo,
  id: string,
): Promise<string[]> {
  const actual = await claveActual(destino, id);
  return actual ? clavesDe(actual, TAMANOS_LOGO) : [];
}

export async function borrarArchivos(claves: string[]): Promise<void> {
  await borrarClaves(claves);
}

export function urlDeLogo(
  logoKey: string | null,
  sufijo: "thumb" | "card" = "thumb",
): string | null {
  return logoKey ? getStorage().publicUrl(clave(logoKey, sufijo)) : null;
}

// Foto de perfil: el mismo orden que un logo, pero fuera de `LOGOS` porque la
// escribe cada persona sobre su cuenta, con otra ruta y otro control de acceso.

async function fotoActual(userId: string): Promise<string | null | undefined> {
  const [fila] = await db
    .select({ avatarKey: userProfiles.avatarKey })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId));
  return fila?.avatarKey;
}

async function apuntarFoto(
  userId: string,
  avatarKey: string | null,
): Promise<void> {
  await db
    .update(userProfiles)
    .set({ avatarKey, updatedAt: new Date() })
    .where(eq(userProfiles.id, userId));
}

export async function publicarFotoDePerfil({
  userId,
  archivo,
}: {
  userId: string;
  archivo: Buffer;
}): Promise<{ avatarKey: string }> {
  const anterior = await fotoActual(userId);
  if (anterior === undefined) throw domainError("NOT_FOUND");

  const procesada = await procesarImagen(archivo, TAMANOS_PERFIL);

  const base = claveDeFotoDePerfil(userId, crypto.randomUUID());
  const subidas = await subirVersiones(base, procesada.versiones);

  try {
    await apuntarFoto(userId, base);
  } catch (e) {
    await borrarClaves(subidas);
    throw e;
  }

  // Después de apuntar a la nueva, como en el logo.
  if (anterior) await borrarClaves(clavesDe(anterior, TAMANOS_PERFIL));

  return { avatarKey: base };
}

/** La usan «Quitar foto» y la baja ejecutada. Sin foto no hace nada. */
export async function quitarFotoDePerfil(userId: string): Promise<void> {
  const anterior = await fotoActual(userId);
  if (!anterior) return;

  await apuntarFoto(userId, null);
  await borrarClaves(clavesDe(anterior, TAMANOS_PERFIL));
}

/** Para la baja ejecutada, que borra los archivos después de confirmar su transacción. */
export async function borrarArchivosDeFoto(avatarKey: string): Promise<void> {
  await borrarClaves(clavesDe(avatarKey, TAMANOS_PERFIL));
}

export function urlDeFotoDePerfil(avatarKey: string | null): string | null {
  return avatarKey
    ? getStorage().publicUrl(clave(avatarKey, TAMANOS_PERFIL[0].sufijo))
    : null;
}
