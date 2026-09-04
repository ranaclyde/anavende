import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { urlDeImagen } from "@/modules/media/subir";

/**
 * Lecturas de variantes para el panel — RF-16, §9.5.
 *
 * **Dos consultas y no una por variante.** Las variantes salen en una y todas
 * las imágenes del producto en otra; el reenvío de §9.5 —una variante que
 * reutiliza las imágenes de otra— se resuelve acá con las filas ya en
 * memoria. Pedir las imágenes variante por variante sería N+1 en la pantalla
 * que más se usa del panel.
 */

export type ImagenDeVariante = {
  id: string;
  /** Ya resuelta: la vista recibe una URL, nunca una clave (§9.4). */
  url: string;
  altText: string | null;
  sortOrder: number;
  width: number;
  height: number;
};

export type VarianteDelPanel = {
  id: string;
  /** `null` = variante única: el producto no se vende por color (RF-16). */
  colorId: string | null;
  colorName: string | null;
  colorHex: string | null;
  /** RN-11b: un color inactivo no puede estar en una variante activa. */
  colorIsActive: boolean | null;
  stockTotal: number;
  reservedStock: number;
  /** `stock_total − reserved_stock` (§8.1). Puede ser negativo (RF-24). */
  disponible: number;
  isActive: boolean;
  /** De qué variante reutiliza las imágenes; `null` = usa las propias (§9.5). */
  imagesSourceId: string | null;
  fuenteColorName: string | null;
  /** Cuántas variantes reutilizan LAS DE ESTA. Si es > 0, borrarla las deja sin. */
  prestadaA: number;
  /** Las suyas, estén o no a la vista. Decide si puede pasar a reutilizar. */
  propias: number;
  /** Órdenes que la nombran. Si hay alguna, borrar la desactiva (RN-11). */
  ordenes: number;
  /** Las que se muestran: las propias, o las de la fuente (§9.5). */
  imagenes: ImagenDeVariante[];
};

type FilaDeVariante = Omit<VarianteDelPanel, "imagenes">;

type FilaDeImagen = {
  id: string;
  variantId: string;
  storageKey: string;
  altText: string | null;
  sortOrder: number;
  width: number;
  height: number;
};

export async function variantesDelProducto(
  productId: string,
): Promise<VarianteDelPanel[]> {
  const [variantes, imagenes] = await Promise.all([
    db.execute<FilaDeVariante>(sql`
      SELECT v.id,
             v.color_id          AS "colorId",
             c.name              AS "colorName",
             c.hex_code          AS "colorHex",
             c.is_active         AS "colorIsActive",
             v.stock_total       AS "stockTotal",
             v.reserved_stock    AS "reservedStock",
             v.stock_total - v.reserved_stock AS "disponible",
             v.is_active         AS "isActive",
             v.images_source_id  AS "imagesSourceId",
             cf.name             AS "fuenteColorName",
             (SELECT count(*) FROM product_variants o
               WHERE o.images_source_id = v.id)::int        AS "prestadaA",
             (SELECT count(*) FROM variant_images i
               WHERE i.variant_id = v.id)::int              AS propias,
             (SELECT count(DISTINCT oi.order_id) FROM order_items oi
               WHERE oi.variant_id = v.id)::int             AS ordenes
        FROM product_variants v
        LEFT JOIN colors c           ON c.id = v.color_id
        LEFT JOIN product_variants f ON f.id = v.images_source_id
        LEFT JOIN colors cf          ON cf.id = f.color_id
       WHERE v.product_id = ${productId}
       -- La variante única (sin color) va primero: en un producto de un solo
       -- color es la única fila, y en uno de varios no debería existir.
       ORDER BY v.sort_order,
                immutable_unaccent(lower(coalesce(c.name, '')))`),

    db.execute<FilaDeImagen>(sql`
      SELECT i.id,
             i.variant_id  AS "variantId",
             i.storage_key AS "storageKey",
             i.alt_text    AS "altText",
             i.sort_order  AS "sortOrder",
             i.width, i.height
        FROM variant_images i
        JOIN product_variants v ON v.id = i.variant_id
       WHERE v.product_id = ${productId}
       ORDER BY i.sort_order, i.created_at`),
  ]);

  const porVariante = new Map<string, ImagenDeVariante[]>();
  for (const i of imagenes) {
    const lista = porVariante.get(i.variantId) ?? [];
    lista.push({
      id: i.id,
      // La miniatura de 200px alcanza para el recuadro del panel incluso en
      // una pantalla del doble de densidad. `-card` pesaría tres veces más
      // para mostrarse a 96px (§9.2).
      url: urlDeImagen(i.storageKey, "thumb"),
      altText: i.altText,
      sortOrder: i.sortOrder,
      width: i.width,
      height: i.height,
    });
    porVariante.set(i.variantId, lista);
  }

  return variantes.map((v) => ({
    ...v,
    // §9.5, tal cual: un solo salto, sin cadenas. Si la fuente no tiene
    // ninguna, esta tampoco muestra ninguna — y eso se ve en la pantalla.
    imagenes: porVariante.get(v.imagesSourceId ?? v.id) ?? [],
  }));
}

export type OpcionDeColor = {
  id: string;
  name: string;
  hexCode: string;
  isActive: boolean;
};

/**
 * Los colores del selector de variantes.
 *
 * Vienen TODOS, con su estado, por el mismo motivo que las marcas del
 * formulario de producto: una variante inactiva puede tener un color
 * inactivo, y traer solo los activos dejaría el selector en blanco al abrirla
 * y le cambiaría el color al guardar.
 */
export async function opcionesDeColor(): Promise<OpcionDeColor[]> {
  return db.execute<OpcionDeColor>(sql`
    SELECT id, name, hex_code AS "hexCode", is_active AS "isActive"
      FROM colors
     ORDER BY is_active DESC, immutable_unaccent(lower(name))`);
}
