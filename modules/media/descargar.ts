import "server-only";

import { sql } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import { slugificar } from "@/lib/slug";
import { almacenamiento } from "@/lib/storage";
import { armarZip, type ArchivoDelZip } from "@/lib/zip";
import { clave } from "@/modules/media/tamanos";

/**
 * Las fotos de un producto en un zip, para usarlas fuera de la tienda —
 * F2.18, pedido del 2026-11-16.
 *
 * **Se baja la `-detail`**, la más grande que hay (1400px de ancho): el
 * original no se guarda nunca (§9.0). Va **tal como está**, con la marca de
 * agua si la tiene y sin ella si no: es la misma foto que ve quien compra.
 *
 * **En JPG y no en WEBP** (decisión del 2026-11-16): WhatsApp, Instagram y
 * MercadoLibre lo toman sin vueltas, y un WEBP en WhatsApp a veces llega
 * como documento o como sticker. Lo transparente se aplana sobre blanco, que
 * es el fondo de la galería (DR §6.8).
 *
 * **Una carpeta por color**, con las fotos en el orden del panel: la primera
 * es la portada. Solo las **propias** de cada color: las que reutiliza de
 * otro (§9.5) ya van en la carpeta de ese otro. La variante única, sin
 * color, deja sus fotos sueltas.
 */

export type FotoDelProducto = {
  /** `null` = la variante única: sin carpeta. */
  color: string | null;
  storageKey: string;
};

export type FotosDelProducto = { slug: string; fotos: FotoDelProducto[] };

/** `null` = el producto no existe. */
export async function fotosDelProducto(
  productId: string,
): Promise<FotosDelProducto | null> {
  const [producto] = await db.execute<{ slug: string }>(sql`
    SELECT slug FROM products WHERE id = ${productId}`);
  if (!producto) return null;

  const fotos = await db.execute<FotoDelProducto>(sql`
    SELECT c.name        AS color,
           i.storage_key AS "storageKey"
      FROM variant_images i
      JOIN product_variants v ON v.id = i.variant_id
      LEFT JOIN variant_colors c ON c.variant_id = v.id
     WHERE v.product_id = ${productId}
     -- El mismo orden que el panel: colores por su orden y nombre, y las
     -- fotos de cada uno con la portada primero.
     ORDER BY v.sort_order,
              immutable_unaccent(lower(coalesce(c.name, ''))),
              v.id,
              i.sort_order,
              i.created_at`);

  return { slug: producto.slug, fotos: [...fotos] };
}

/**
 * Dónde va cada foto adentro del zip: `negro/1.jpg`, `negro-rojo/2.jpg`, o
 * `1.jpg` sin color. Si dos colores dieran la misma carpeta —«Negro/Rojo» y
 * uno que se llame «Negro Rojo»—, el segundo lleva `-2`: pisarse sería
 * perder fotos sin que nadie se entere.
 */
export function nombresEnElZip(fotos: readonly FotoDelProducto[]): string[] {
  const carpetaDe = new Map<string, string>();
  const usadas = new Set<string>();
  const cuenta = new Map<string, number>();

  return fotos.map(({ color }) => {
    let carpeta = "";
    if (color !== null) {
      let elegida = carpetaDe.get(color);
      if (elegida === undefined) {
        const base = slugificar(color) || "color";
        elegida = base;
        for (let i = 2; usadas.has(elegida); i++) elegida = `${base}-${i}`;
        usadas.add(elegida);
        carpetaDe.set(color, elegida);
      }
      carpeta = elegida;
    }
    const n = (cuenta.get(carpeta) ?? 0) + 1;
    cuenta.set(carpeta, n);
    return carpeta ? `${carpeta}/${n}.jpg` : `${n}.jpg`;
  });
}

/** Cuántas se leen y convierten a la vez: sharp ya usa varios hilos. */
const EN_PARALELO = 4;

export async function aJpg(webp: Buffer): Promise<Buffer> {
  return sharp(webp)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/** El zip entero, o `null` si el producto no tiene ninguna foto. */
export async function zipDeFotos({
  fotos,
}: FotosDelProducto): Promise<Buffer | null> {
  if (fotos.length === 0) return null;
  const nombres = nombresEnElZip(fotos);
  const archivos: ArchivoDelZip[] = new Array(fotos.length);

  for (let desde = 0; desde < fotos.length; desde += EN_PARALELO) {
    await Promise.all(
      fotos.slice(desde, desde + EN_PARALELO).map(async (foto, i) => {
        const webp = await almacenamiento().get(
          clave(foto.storageKey, "detail"),
        );
        archivos[desde + i] = {
          nombre: nombres[desde + i],
          datos: await aJpg(webp),
        };
      }),
    );
  }
  return armarZip(archivos);
}
