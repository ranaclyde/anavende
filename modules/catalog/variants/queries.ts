import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { urlDeImagen } from "@/modules/media/subir";

export type ImagenDeVariante = {
  id: string;
  url: string;
  /** La versión `detail`, para el visor. */
  grande: string;
  altText: string | null;
  sortOrder: number;
  width: number;
  height: number;
};

export type VarianteDelPanel = {
  id: string;
  /** `null` = variante única. */
  colorId: string | null;
  /** `null` = de un solo color. */
  secondaryColorId: string | null;
  colorName: string | null;
  colorHex: string | null;
  colorHex2: string | null;
  /** Con dos colores, es el de los dos (RN-11b). */
  colorIsActive: boolean | null;
  stockTotal: number;
  reservedStock: number;
  /** Puede ser negativo (RF-24). */
  disponible: number;
  isActive: boolean;
  /** De qué variante reutiliza las imágenes; `null` = usa las propias. */
  imagesSourceId: string | null;
  fuenteColorName: string | null;
  /** Cuántas reutilizan las de esta. Si es > 0, borrarla las deja sin. */
  prestadaA: number;
  /** Estén o no a la vista. Decide si puede pasar a reutilizar. */
  propias: number;
  /** Si hay alguna, borrar la desactiva (RN-11). */
  ordenes: number;
  /** Si hay alguno, borrar también la desactiva. */
  carritos: number;
  /** Las propias, o las de la fuente. */
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
             v.secondary_color_id AS "secondaryColorId",
             c.name              AS "colorName",
             c.hex_code          AS "colorHex",
             c.hex_code_2        AS "colorHex2",
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
               WHERE oi.variant_id = v.id)::int             AS ordenes,
             (SELECT count(*) FROM cart_items ci
               WHERE ci.variant_id = v.id)::int             AS carritos
        FROM product_variants v
        LEFT JOIN variant_colors c   ON c.variant_id = v.id
        LEFT JOIN product_variants f ON f.id = v.images_source_id
        LEFT JOIN variant_colors cf  ON cf.variant_id = f.id
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
      url: urlDeImagen(i.storageKey, "thumb"),
      grande: urlDeImagen(i.storageKey, "detail"),
      altText: i.altText,
      sortOrder: i.sortOrder,
      width: i.width,
      height: i.height,
    });
    porVariante.set(i.variantId, lista);
  }

  return variantes.map((v) => ({
    ...v,
    // Un solo salto, sin cadenas (TECHNICAL-SPEC §9.5).
    imagenes: porVariante.get(v.imagesSourceId ?? v.id) ?? [],
  }));
}

export type VarianteParaReponer = {
  id: string;
  /** `null` = variante única. */
  colorName: string | null;
  colorHex: string | null;
  colorHex2: string | null;
  stockTotal: number;
  reservedStock: number;
  /** Puede ser negativo (RF-24). */
  disponible: number;
};

/**
 * Para el globo de «Reponer», que se lee al abrirlo. Van también las inactivas:
 * cuentan en el total del listado, y sin ellas el globo no sumaría lo de la fila.
 */
export async function variantesParaReponer(
  productId: string,
): Promise<VarianteParaReponer[]> {
  const filas = await db.execute<VarianteParaReponer>(sql`
    SELECT v.id,
           c.name  AS "colorName",
           c.hex_code AS "colorHex",
           c.hex_code_2 AS "colorHex2",
           v.stock_total    AS "stockTotal",
           v.reserved_stock AS "reservedStock",
           (v.stock_total - v.reserved_stock) AS disponible
      FROM product_variants v
      LEFT JOIN variant_colors c ON c.variant_id = v.id
     WHERE v.product_id = ${productId}
     -- El mismo orden que la ficha: por nombre de color, y la variante única
     -- —sin color— primero, que es la que está sola cuando está.
     ORDER BY c.name NULLS FIRST, v.id`);

  return [...filas];
}

export type OpcionDeColor = {
  id: string;
  name: string;
  hexCode: string;
  isActive: boolean;
};

/**
 * Todos, con su estado: una variante inactiva puede tener un color inactivo, y
 * sin él el selector quedaría en blanco y guardar se lo cambiaría.
 */
export async function opcionesDeColor(): Promise<OpcionDeColor[]> {
  return db.execute<OpcionDeColor>(sql`
    SELECT id, name, hex_code AS "hexCode", is_active AS "isActive"
      FROM colors
     ORDER BY is_active DESC, immutable_unaccent(lower(name))`);
}

export const MINIMO_CON_COLOR = 3;

/**
 * El nombre de la categoría si la mayoría de sus otros productos activos, y al
 * menos `MINIMO_CON_COLOR`, tienen alguna variante con color; si no, `null`.
 */
export async function categoriaQueSeVendePorColor(
  productId: string,
): Promise<string | null> {
  const [fila] = await db.execute<{
    nombre: string;
    conColor: number;
    total: number;
  }>(sql`
    SELECT c.name AS nombre,
           count(p.id) FILTER (WHERE EXISTS (
             SELECT 1 FROM product_variants v
              WHERE v.product_id = p.id AND v.is_active
                AND v.color_id IS NOT NULL))::int AS "conColor",
           count(p.id)::int AS total
      FROM products yo
      JOIN categories c ON c.id = yo.category_id
      LEFT JOIN products p
        ON p.category_id = yo.category_id AND p.is_active AND p.id <> yo.id
       AND EXISTS (SELECT 1 FROM product_variants v
                    WHERE v.product_id = p.id AND v.is_active)
     WHERE yo.id = ${productId}
     GROUP BY c.name`);

  if (!fila) return null;
  return fila.conColor >= MINIMO_CON_COLOR && fila.conColor * 2 > fila.total
    ? fila.nombre
    : null;
}
