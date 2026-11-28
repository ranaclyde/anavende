import "server-only";

import { sql } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import { slugify } from "@/lib/slug";
import { getStorage } from "@/lib/storage";
import { buildZip, type ZipEntry } from "@/lib/zip";
import { clave } from "@/modules/media/tamanos";

// Las fotos de un producto en un zip (TECHNICAL-SPEC §9.7). Solo las propias
// de cada color: las reutilizadas (§9.5) ya van en la carpeta del otro.

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

/** Si dos colores dieran la misma carpeta, el segundo lleva `-2` para no pisarse. */
export function nombresEnElZip(fotos: readonly FotoDelProducto[]): string[] {
  const carpetaDe = new Map<string, string>();
  const usadas = new Set<string>();
  const cuenta = new Map<string, number>();

  return fotos.map(({ color }) => {
    let carpeta = "";
    if (color !== null) {
      let elegida = carpetaDe.get(color);
      if (elegida === undefined) {
        const base = slugify(color) || "color";
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
  const archivos: ZipEntry[] = new Array(fotos.length);

  for (let desde = 0; desde < fotos.length; desde += EN_PARALELO) {
    await Promise.all(
      fotos.slice(desde, desde + EN_PARALELO).map(async (foto, i) => {
        const webp = await getStorage().get(clave(foto.storageKey, "detail"));
        archivos[desde + i] = {
          name: nombres[desde + i],
          data: await aJpg(webp),
        };
      }),
    );
  }
  return buildZip(archivos);
}
