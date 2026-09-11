import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import type { Money } from "@/lib/money";
import { urlDeImagen } from "@/modules/media/subir";

/**
 * La ficha de producto — F3.5, RF-03, §7.3, §10.1.
 *
 * **Una sola consulta, con las variantes y sus imágenes adentro.** Podrían
 * ser tres —producto, variantes, imágenes— y serían tres viajes encadenados:
 * hasta no saber el `id` del producto no se pueden pedir sus variantes, y
 * hasta no tener las variantes no se piden las imágenes. Es el waterfall
 * clásico, y acá se paga entero porque la ficha no puede pintar nada sin las
 * tres cosas.
 *
 * Por qué NO filtra por `b.is_active` ni `c.is_active`: el mismo motivo que
 * el catálogo (`tienda.ts`). RN-11b prohíbe que un producto activo tenga
 * marca, categoría o color inactivos, y esa invariante la sostiene la base.
 */

/** Una imagen ya resuelta a URLs: la vista no arma claves de Storage (§9.4). */
export type ImagenDeFicha = {
  /** 1400px (§9.2) — la principal y la ampliada del modal. */
  grande: string;
  /** 200px — la tira de miniaturas de §6.8. */
  miniatura: string;
  /** Lo que escribió la vendedora, o `null`: lo completa quien lo muestra. */
  alt: string | null;
};

export type VarianteDeFicha = {
  /** Lo que agrega al carrito (F5.5): el renglón del carrito es la variante. */
  id: string;
  /** Lo que va en `?color=`. `null` si el producto no viene en colores. */
  colorSlug: string | null;
  colorNombre: string | null;
  colorHex: string | null;
  /** `stock_total − reserved_stock` (§8.1). Puede ser NEGATIVO — ver RF-24. */
  disponible: number;
  /**
   * Las de la variante, o las de su respaldo (§9.5, RF-16). Puede venir
   * vacía: F2.4 da de alta en dos pasos, así que una variante sin fotos
   * todavía existe de verdad.
   */
  imagenes: ImagenDeFicha[];
};

export type Ficha = {
  slug: string;
  nombre: string;
  /** Markdown ya sanitizado al guardar; se vuelve a filtrar al pintar (§16). */
  descripcion: string;
  /**
   * La misma descripción sin marcadores: es la columna generada
   * `description_text` de §5.4, que existe para que la búsqueda encuentre
   * `Cable **HDMI**`. Acá sirve para la descripción de los metadatos, y por
   * eso se trae en vez de volver a limpiar el Markdown en JavaScript: ya está
   * limpia, y una segunda limpieza es una segunda opinión sobre lo mismo.
   */
  descripcionTexto: string;
  marca: string;
  categoria: string;
  categoriaId: string;
  precio: Money;
  descuento: Money;
  precioFinal: Money;
  variantes: VarianteDeFicha[];
};

type FilaDeVariante = {
  id: string;
  colorSlug: string | null;
  colorNombre: string | null;
  colorHex: string | null;
  disponible: number;
  imagenes: { key: string; alt: string | null }[];
};

/**
 * **Envuelta en `cache()` de React**, que deduplica por pedido: la página y
 * `generateMetadata` piden la misma ficha y sin esto serían dos consultas
 * idénticas contra la base en cada visita. `fetch` lo hace solo; una consulta
 * por Drizzle no.
 *
 * `null` cuando el producto no existe o está desactivado. Los dos casos dan
 * lo mismo hacia afuera y tienen que darlo: RN-05 dice que un producto
 * inactivo no es visible en el sitio público, y distinguirlo de uno
 * inexistente contaría que existe.
 */
export const leerFicha = cache(async function leerFicha(
  slug: string,
): Promise<Ficha | null> {
  const [fila] = await db.execute<
    Omit<Ficha, "variantes"> & { variantes: FilaDeVariante[] | null }
  >(sql`
    SELECT p.slug,
           p.name             AS nombre,
           p.description      AS descripcion,
           p.description_text AS "descripcionTexto",
           p.price            AS precio,
           p.discount         AS descuento,
           p.final_price      AS "precioFinal",
           b.name             AS marca,
           c.name             AS categoria,
           c.id               AS "categoriaId",
           vs.lista           AS variantes
      FROM products p
      JOIN brands b     ON b.id = p.brand_id
      JOIN categories c ON c.id = p.category_id

      -- Las variantes activas con sus imágenes. El orden es el que configuró
      -- la vendedora y el nombre desempata: sort_order se renumera sin huecos,
      -- pero dos filas escritas por fuera del panel pueden compartir número, y
      -- sin desempate el selector de color cambiaría de orden entre dos cargas
      -- de la misma pantalla.
      LEFT JOIN LATERAL (
        SELECT coalesce(
                 json_agg(x.fila ORDER BY x.orden, x.nombre NULLS LAST),
                 '[]'::json
               ) AS lista
          FROM (
            SELECT v.sort_order AS orden,
                   co.name      AS nombre,
                   json_build_object(
                     'id',          v.id,
                     'colorSlug',   co.slug,
                     'colorNombre', co.name,
                     'colorHex',    co.hex_code,
                     'disponible',  v.stock_total - v.reserved_stock,
                     -- §9.5: una variante puede mostrar las fotos de otra.
                     -- Sin el coalesce, la que reutiliza sale sin ninguna.
                     'imagenes',    (
                       SELECT coalesce(
                                json_agg(
                                  json_build_object(
                                    'key', i.storage_key,
                                    'alt', i.alt_text
                                  )
                                  ORDER BY i.sort_order
                                ),
                                '[]'::json
                              )
                         FROM variant_images i
                        WHERE i.variant_id = coalesce(v.images_source_id, v.id)
                     )
                   ) AS fila
              FROM product_variants v
              LEFT JOIN colors co ON co.id = v.color_id
             WHERE v.product_id = p.id AND v.is_active
          ) x
      ) vs ON true

     WHERE p.slug = ${slug} AND p.is_active
  `);

  if (!fila) return null;

  return {
    ...fila,
    variantes: (fila.variantes ?? []).map((v) => ({
      id: v.id,
      colorSlug: v.colorSlug,
      colorNombre: v.colorNombre,
      colorHex: v.colorHex,
      disponible: v.disponible,
      // Las URLs se arman ACÁ y no en el componente: `urlDeImagen` necesita
      // el adaptador de almacenamiento, que es código de servidor, y la
      // galería es una isla de cliente.
      imagenes: v.imagenes.map((i) => ({
        grande: urlDeImagen(i.key, "detail"),
        miniatura: urlDeImagen(i.key, "thumb"),
        alt: i.alt,
      })),
    })),
  };
});

/**
 * Qué variante mostrar al abrir, según el `?color=` de la dirección.
 *
 * Un color que no existe —enlace viejo, o escrito a mano— **no es un 404**:
 * el producto existe y se muestra en su primera variante. Devolver 404 por
 * un parámetro de consulta castigaría a quien guardó el enlace de un color
 * que la vendedora dio de baja, y lo que quiere ver sigue estando ahí.
 *
 * Devuelve `-1` si el producto no tiene ninguna variante activa, que es un
 * estado real: F2.4 da de alta en dos pasos.
 */
export function varianteInicial(
  variantes: VarianteDeFicha[],
  color: string | undefined,
): number {
  if (variantes.length === 0) return -1;
  if (!color) return 0;
  const i = variantes.findIndex((v) => v.colorSlug === color);
  return i === -1 ? 0 : i;
}
