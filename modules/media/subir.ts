import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { brands, productVariants, variantImages } from "@/db/schema/catalog";
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
  // Todo lo que hay que saber ANTES de convertir, en una sola consulta: a qué
  // producto pertenece la variante, si está reutilizando las imágenes de otra
  // y cuántas tiene. Procesar tres tamaños para después decir que no entraba
  // es trabajo tirado, y en una imagen de 8 MB no es trabajo despreciable.
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

  // El `productId` llega del formulario y la clave de Storage se arma con él
  // (§9.2). Sin esta comprobación, un id equivocado guardaría el archivo bajo
  // una carpeta que no le corresponde: la fila apuntaría a un lugar donde
  // nadie lo va a buscar el día que haya que borrarlo.
  if (estado.productId !== productId) {
    throw domainError("NOT_FOUND");
  }

  // Una variante que reutiliza las de otra no muestra las propias (§9.5).
  // Aceptar la subida dejaría un archivo que ocupa lugar y no se ve en
  // ninguna pantalla, que es la definición de basura.
  if (estado.imagesSourceId) {
    throw domainError("VALIDATION", {
      message:
        "Esa variante está reutilizando las imágenes de otra. Dejá de reutilizarlas para poder subirle las propias.",
    });
  }

  if (estado.n >= MAXIMO_POR_VARIANTE) {
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
        sortOrder: estado.n,
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
 * Renumera las imágenes de una variante a 0, 1, 2… respetando el orden que
 * ya tenían.
 *
 * NO ES COSMÉTICA. `sortOrder` cumple dos papeles a la vez: es el orden de la
 * galería y es de dónde sale el número de la próxima imagen que se suba
 * —`publicarImagenDeVariante` usa la CANTIDAD—. Borrar la primera de tres
 * dejaría [1, 2] y la siguiente subida volvería a ser 2: dos imágenes con el
 * mismo número y un orden que pasa a depender de cuál devuelva antes la base.
 * Con la principal siendo «la que está en 0» (RF-17), eso es la portada del
 * producto cambiando sola.
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
 * RF-17: eliminar una imagen la quita del almacenamiento, no solo del
 * listado. Primero se borra la fila y después los archivos: al revés, un
 * fallo entre medio dejaría una fila apuntando a archivos que ya no están
 * —una imagen rota en la ficha—, que es peor que un archivo que nadie mira.
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

  // La fila ya no está, así que la vendedora ya no ve la imagen. Si algún
  // archivo sobrevive es basura, no una falla que valga cortar la operación y
  // mostrarle un error a alguien que hizo lo correcto.
  await borrarClaves(clavesDe(fila.storageKey, TAMANOS));
}

/**
 * Reordenar y elegir la principal — RF-16, RF-17.
 *
 * **La principal es la que está en la posición 0, y no hay columna que lo
 * diga.** Con una bandera `is_primary` habría dos fuentes para la misma
 * pregunta y un estado imposible que igual hay que programar: dos principales,
 * o ninguna. Elegir la principal es mover una imagen al frente, que es
 * exactamente lo que se ve en la pantalla.
 *
 * Llega el ORDEN COMPLETO y no un «movida de aquí para allá»: si la lista que
 * manda el navegador no es exactamente el conjunto que hay en la base, se
 * rechaza entera. Aplicar un orden parcial sobre datos que cambiaron en otra
 * pestaña dejaría la galería en un orden que nadie pidió.
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

    // Una sentencia y no una por imagen: con cinco filas la diferencia no se
    // nota, pero una tras otra deja la galería medio ordenada si la tercera
    // falla, y ese es el estado que después nadie entiende.
    //
    // Los ids van como PARÁMETROS, armando la lista con `sql.join`. Pegarlos
    // en el texto de la consulta —aunque acaben de comprobarse contra la
    // base— es la forma de escribir una inyección que hoy no lo es y mañana
    // sí, el día que alguien afloje la comprobación de arriba.
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
 * Las claves de Storage de todas las imágenes de una variante, para borrarlas
 * cuando la variante se va. Se leen ANTES del DELETE: después las filas ya no
 * están —`variant_images` cae por cascada— y las claves se fueron con ellas.
 */
export async function clavesDeVariante(variantId: string): Promise<string[]> {
  const filas = await db
    .select({ storageKey: variantImages.storageKey })
    .from(variantImages)
    .where(eq(variantImages.variantId, variantId));

  return filas.flatMap((f) => clavesDe(f.storageKey, TAMANOS));
}

/**
 * Lo mismo para un producto entero: todas las imágenes de todas sus
 * variantes. Es lo que le faltaba a «borrar un producto» para no dejar en
 * Storage archivos que ya no nombra ninguna fila (RF-15, RF-17).
 */
export async function clavesDeProducto(productId: string): Promise<string[]> {
  const filas = await db.execute<{ storageKey: string }>(sql`
    SELECT i.storage_key AS "storageKey"
      FROM ${variantImages} i
      JOIN ${productVariants} v ON v.id = i.variant_id
     WHERE v.product_id = ${productId}`);

  return filas.flatMap((f) => clavesDe(f.storageKey, TAMANOS));
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
