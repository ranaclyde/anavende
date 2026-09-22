import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ProductoEnTarjeta } from "@/components/shop/tarjeta-producto";
import { urlDeImagen, urlDeLogo } from "@/modules/media/subir";
import {
  aTarjeta,
  COLUMNAS_DE_TARJETA,
  enLaLista,
  UNIONES_DE_TARJETA,
  type FilaDeTarjeta,
} from "@/modules/catalog/products/tienda";

/**
 * Lo que la home necesita — RF-01, §7.1. Tarea F3.7.
 *
 * **Una sola llamada y no seis**, porque las seis consultas son independientes
 * entre sí salvo una: las secciones por categoría y la sección de «más
 * categorías» necesitan saber cuáles son las destacadas. Así que va en dos
 * tandas —primero las categorías, después todo lo demás en paralelo— y no en
 * seis viajes encadenados.
 *
 * **El hero sale de la MISMA consulta que las secciones** (2026-09-22): son
 * los mismos productos de las mismas categorías, mirados de otra manera. Una
 * consulta propia para el hero traería otra vez lo que ya está en memoria y,
 * peor, podría traer otro orden —el hero mostrando un teclado que su sección
 * no muestra—.
 *
 * **Las tarjetas salen del mismo par de fragmentos que el catálogo**
 * (`COLUMNAS_DE_TARJETA` y `UNIONES_DE_TARJETA`): una segunda definición de
 * «qué necesita una tarjeta» terminaría mostrando otra portada o otro stock
 * para el mismo producto según la pantalla.
 */

/** El tope de §7.1: con más, la fila de chips deja de leerse como un atajo. */
export const CATEGORIAS_EN_LA_HOME = 7;

/** Una fila de la grilla de escritorio (§7.1). Si no llena, no se rellena. */
export const POR_SECCION = 4;

/** Los bloques flotantes del hero (§7.1). Se dibujan los que haya. */
export const EN_EL_HERO = 5;

/**
 * Debajo de esto la categoría no entra a la rotación del hero (§7.1): con dos
 * bloques el arco no se lee como un arco, se lee como que faltan cosas.
 */
export const MINIMO_EN_EL_HERO = 3;

/**
 * Cuántos productos se traen por categoría destacada.
 *
 * No es `POR_SECCION`: la sección usa los primeros cuatro, pero el hero usa
 * los primeros cinco **con foto**, y un producto sin foto no sirve para un
 * bloque que es casi toda imagen (F2.4 hace el alta en dos pasos, así que
 * productos sin foto existen de verdad). Se piden ocho para que un par sin
 * foto no dejen el hero corto, y el recorte pasa acá al lado, sin otro viaje.
 */
const POR_CATEGORIA = 8;

/** Cuántas se nombran abajo. No es un listado: es una muestra con salida. */
export const MAS_CATEGORIAS = 8;

export type CategoriaDeLaHome = {
  id: string;
  nombre: string;
  productos: ProductoEnTarjeta[];
};

/**
 * Lo que viaja al navegador por cada bloque del hero, y nada más.
 *
 * El hero es un componente de cliente —tiene un reloj y se frena cuando lo
 * mirás—, así que todo lo que reciba se serializa dentro del HTML. Mandarle
 * `ProductoEnTarjeta` entero sería mandar precios, colores y stock de hasta
 * 35 productos para dibujar una foto y dos renglones.
 */
export type ProductoDelHero = {
  slug: string;
  nombre: string;
  /**
   * Ya resuelta, y en `card` y no en `thumb`: el bloque se dibuja a 136px,
   * pero en una pantalla de las de hoy eso son 272 píxeles de imagen y
   * `thumb` tiene 200. Con la foto de relleno del seed casi no se nota; con
   * una foto de verdad, el borde de un teclado a 200px estirado a 272 sí.
   */
  src: string;
};

export type ConjuntoDelHero = {
  categoria: string;
  productos: ProductoDelHero[];
};

export type MedioDePagoDeLaHome = {
  id: string;
  nombre: string;
  /** Ya resuelta: la clave de Storage no le sirve a nadie en el cliente. */
  logoUrl: string;
};

export type DatosDeLaHome = {
  /** Las destacadas, hasta siete: son los chips Y las secciones. */
  destacadas: CategoriaDeLaHome[];
  /** Una tanda de bloques por categoría que llegue al mínimo (§7.1). */
  hero: ConjuntoDelHero[];
  destacados: ProductoEnTarjeta[];
  ofertas: ProductoEnTarjeta[];
  /** Las demás activas, para la sección del pie. */
  masCategorias: { id: string; nombre: string }[];
  mediosDePago: MedioDePagoDeLaHome[];
};

export async function leerHome(): Promise<DatosDeLaHome> {
  // Las destacadas primero: de sus ids dependen las otras dos consultas de
  // categorías. Entre destacadas desempata el nombre (§5.4).
  const destacadas = await db.execute<{ id: string; nombre: string }>(sql`
    SELECT id, name AS nombre
      FROM categories
     WHERE is_active AND is_featured
     ORDER BY immutable_unaccent(lower(name))
     LIMIT ${CATEGORIAS_EN_LA_HOME}`);

  const ids = destacadas.map((c) => c.id);

  const [porCategoria, destacados, ofertas, masCategorias, mediosDePago] =
    await Promise.all([
      productosPorCategoria(ids),

      // «Destacados» es la bandera de RF-20, y adentro va lo último cargado:
      // es la sección que la vendedora usa para mover lo que le interesa hoy,
      // así que lo nuevo tiene que subir solo.
      db.execute<FilaDeTarjeta>(sql`
        SELECT ${COLUMNAS_DE_TARJETA}
          FROM products p
          JOIN brands b ON b.id = p.brand_id
          ${UNIONES_DE_TARJETA}
         WHERE p.is_active AND p.is_featured
         ORDER BY p.created_at DESC, p.id
         LIMIT ${POR_SECCION}`),

      // «En oferta»: primero el descuento más grande, que es lo que hace que
      // la sección valga la pena mirarla.
      db.execute<FilaDeTarjeta>(sql`
        SELECT ${COLUMNAS_DE_TARJETA}
          FROM products p
          JOIN brands b ON b.id = p.brand_id
          ${UNIONES_DE_TARJETA}
         WHERE p.is_active AND p.discount > 0
         ORDER BY p.discount DESC, p.id
         LIMIT ${POR_SECCION}`),

      // Las que no están arriba, **y sólo si tienen algo que mostrar**: una
      // categoría vacía nombrada en la home es un enlace a un «no hay nada».
      db.execute<{ id: string; nombre: string }>(sql`
        SELECT c.id, c.name AS nombre
          FROM categories c
         WHERE c.is_active
           ${ids.length ? sql`AND NOT ${enLaLista(sql`c.id`, ids)}` : sql``}
           AND EXISTS (SELECT 1 FROM products p
                        WHERE p.category_id = c.id AND p.is_active)
         ORDER BY immutable_unaccent(lower(c.name))
         LIMIT ${MAS_CATEGORIAS}`),

      // Sólo los que tienen logo (§7.1): un nombre suelto en una fila de
      // logos se lee como una imagen que no cargó.
      db.execute<{ id: string; nombre: string; logoKey: string }>(sql`
        SELECT id, name AS nombre, logo_key AS "logoKey"
          FROM payment_methods
         WHERE is_active AND logo_key IS NOT NULL
         ORDER BY sort_order, immutable_unaccent(lower(name))`),
    ]);

  const conProductos = destacadas.map((c) => ({
    ...c,
    filas: porCategoria.get(c.id) ?? [],
  }));

  return {
    destacadas: conProductos.map(({ filas, ...c }) => ({
      ...c,
      productos: filas.slice(0, POR_SECCION).map(aTarjeta),
    })),

    hero: conProductos.flatMap(({ nombre, filas }) => {
      const productos = filas
        .flatMap((f) =>
          f.imagenKey
            ? [
                {
                  slug: f.slug,
                  nombre: f.nombre,
                  src: urlDeImagen(f.imagenKey, "card"),
                },
              ]
            : [],
        )
        .slice(0, EN_EL_HERO);

      return productos.length >= MINIMO_EN_EL_HERO
        ? [{ categoria: nombre, productos }]
        : [];
    }),

    destacados: destacados.map(aTarjeta),
    ofertas: ofertas.map(aTarjeta),
    masCategorias: [...masCategorias],
    mediosDePago: mediosDePago.flatMap(({ logoKey, ...medio }) => {
      const logoUrl = urlDeLogo(logoKey, "thumb");
      return logoUrl ? [{ ...medio, logoUrl }] : [];
    }),
  };
}

/**
 * Los productos de varias categorías, **en una sola consulta**.
 *
 * Una consulta por categoría serían siete viajes a la base para dibujar una
 * pantalla; `row_number()` sobre la partición de categoría trae las filas de
 * cada una y se recorta afuera. Dentro de cada sección: los destacados arriba
 * y después alfabético, que es el mismo orden público del catálogo (§10.2) y
 * evita que la home y el listado muestren dos primeros distintos.
 */
async function productosPorCategoria(
  ids: readonly string[],
): Promise<Map<string, FilaDeTarjeta[]>> {
  const porCategoria = new Map<string, FilaDeTarjeta[]>();
  if (ids.length === 0) return porCategoria;

  const filas = await db.execute<FilaDeTarjeta & { categoriaId: string }>(sql`
    SELECT * FROM (
      SELECT ${COLUMNAS_DE_TARJETA},
             p.category_id AS "categoriaId",
             row_number() OVER (
               PARTITION BY p.category_id
               ORDER BY p.is_featured DESC,
                        immutable_unaccent(lower(p.name)), p.id
             ) AS n
        FROM products p
        JOIN brands b ON b.id = p.brand_id
        ${UNIONES_DE_TARJETA}
       WHERE p.is_active AND ${enLaLista(sql`p.category_id`, ids)}
    ) x
     WHERE x.n <= ${POR_CATEGORIA}
     -- El ORDER BY de afuera no es decorativo: sin él, Postgres devuelve las
     -- filas de la subconsulta en el orden que le conviene, y lo que la home
     -- llama «los primeros cuatro» pasa a ser «cuatro cualesquiera». Se notó
     -- al usar la misma consulta para el hero, que toma «los primeros cinco
     -- con foto».
     ORDER BY x."categoriaId", x.n`);

  for (const fila of filas) {
    const lista = porCategoria.get(fila.categoriaId) ?? [];
    lista.push(fila);
    porCategoria.set(fila.categoriaId, lista);
  }
  return porCategoria;
}
