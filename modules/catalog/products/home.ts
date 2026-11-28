import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { argentinaDayNumber } from "@/lib/scenes";
import { dailyPick } from "@/lib/daily-pick";
import type { ProductoEnTarjeta } from "@/components/shop/tarjeta-producto";
import { urlDeLogo } from "@/modules/media/subir";
import {
  aTarjeta,
  COLUMNAS_DE_TARJETA,
  enLaLista,
  UNIONES_DE_TARJETA,
  type FilaDeTarjeta,
} from "@/modules/catalog/products/tienda";

// Las tarjetas usan los mismos fragmentos que el catálogo, para que un producto
// no muestre otra portada u otro stock según la pantalla.

export const CATEGORIAS_EN_LA_HOME = 7;

/** Una fila de la grilla de escritorio. Si no llena, no se rellena. */
export const POR_SECCION = 4;

const POR_CATEGORIA = POR_SECCION;

export const MAS_CATEGORIAS = 8;

export type CategoriaDeLaHome = {
  id: string;
  slug: string;
  nombre: string;
  productos: ProductoEnTarjeta[];
};

export const CATEGORIAS_DEL_HERO = 6;

export type CategoriaDelHero = {
  id: string;
  slug: string;
  nombre: string;
  imagenUrl: string | null;
  cantidad: number;
};

export type MedioDePagoDeLaHome = {
  id: string;
  nombre: string;
  logoUrl: string;
};

export type CategoriaEnTarjeta = {
  id: string;
  slug: string;
  nombre: string;
  imagenUrl: string | null;
};

export type DatosDeLaHome = {
  /** Son los chips y las secciones. */
  destacadas: CategoriaDeLaHome[];
  destacados: ProductoEnTarjeta[];
  ofertas: ProductoEnTarjeta[];
  masCategorias: CategoriaEnTarjeta[];
  /** Sorteadas por día entre todas las que tienen productos. */
  delHero: CategoriaDelHero[];
  mediosDePago: MedioDePagoDeLaHome[];
};

export async function leerHome(): Promise<DatosDeLaHome> {
  // Primero: de sus ids dependen otras consultas. El resto va en paralelo.
  const destacadas = await db.execute<{
    id: string;
    slug: string;
    nombre: string;
  }>(sql`
    SELECT id, slug, name AS nombre
      FROM categories
     WHERE is_active AND is_featured
     ORDER BY immutable_unaccent(lower(name))
     LIMIT ${CATEGORIAS_EN_LA_HOME}`);

  const ids = destacadas.map((c) => c.id);

  const [
    porCategoria,
    destacados,
    ofertas,
    masCategorias,
    mediosDePago,
    conProductosActivos,
  ] = await Promise.all([
    productosPorCategoria(ids),

    // Lo último cargado primero, para que lo nuevo suba solo.
    db.execute<FilaDeTarjeta>(sql`
        SELECT ${COLUMNAS_DE_TARJETA}
          FROM products p
          JOIN brands b ON b.id = p.brand_id
          ${UNIONES_DE_TARJETA}
         WHERE p.is_active AND p.is_featured
         ORDER BY p.created_at DESC, p.id
         LIMIT ${POR_SECCION}`),

    db.execute<FilaDeTarjeta>(sql`
        SELECT ${COLUMNAS_DE_TARJETA}
          FROM products p
          JOIN brands b ON b.id = p.brand_id
          ${UNIONES_DE_TARJETA}
         WHERE p.is_active AND p.discount > 0
         ORDER BY p.discount DESC, p.id
         LIMIT ${POR_SECCION}`),

    // Las que no están arriba y tienen algún producto activo.
    db.execute<{
      id: string;
      slug: string;
      nombre: string;
      imageKey: string | null;
    }>(sql`
        SELECT c.id, c.slug, c.name AS nombre, c.image_key AS "imageKey"
          FROM categories c
         WHERE c.is_active
           ${ids.length ? sql`AND NOT ${enLaLista(sql`c.id`, ids)}` : sql``}
           AND EXISTS (SELECT 1 FROM products p
                        WHERE p.category_id = c.id AND p.is_active)
         ORDER BY immutable_unaccent(lower(c.name))
         LIMIT ${MAS_CATEGORIAS}`),

    // Solo los que tienen logo: un nombre suelto se lee como imagen rota.
    db.execute<{ id: string; nombre: string; logoKey: string }>(sql`
        SELECT id, name AS nombre, logo_key AS "logoKey"
          FROM payment_methods
         WHERE is_active AND logo_key IS NOT NULL
         ORDER BY sort_order, immutable_unaccent(lower(name))`),

    // El hero: todas las que tienen algo activo; el sorteo se hace abajo.
    db.execute<{
      id: string;
      slug: string;
      nombre: string;
      imageKey: string | null;
      cantidad: number;
    }>(sql`
      SELECT c.id, c.slug, c.name AS nombre, c.image_key AS "imageKey",
             count(p.id)::int AS cantidad
        FROM categories c
        JOIN products p ON p.category_id = c.id AND p.is_active
       WHERE c.is_active
       GROUP BY c.id`),
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

    destacados: destacados.map(aTarjeta),
    ofertas: ofertas.map(aTarjeta),
    masCategorias: masCategorias.map(({ imageKey, ...categoria }) => ({
      ...categoria,
      imagenUrl: urlDeLogo(imageKey, "card"),
    })),
    delHero: dailyPick(
      conProductosActivos,
      CATEGORIAS_DEL_HERO,
      argentinaDayNumber(),
    ).map(({ imageKey, ...categoria }) => ({
      ...categoria,
      imagenUrl: urlDeLogo(imageKey, "card"),
    })),
    mediosDePago: mediosDePago.flatMap(({ logoKey, ...medio }) => {
      const logoUrl = urlDeLogo(logoKey, "thumb");
      return logoUrl ? [{ ...medio, logoUrl }] : [];
    }),
  };
}

/** Una sola consulta para todas, en el mismo orden público del catálogo. */
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
     -- llama «los primeros cuatro» pasa a ser «cuatro cualesquiera».
     ORDER BY x."categoriaId", x.n`);

  for (const fila of filas) {
    const lista = porCategoria.get(fila.categoriaId) ?? [];
    lista.push(fila);
    porCategoria.set(fila.categoriaId, lista);
  }
  return porCategoria;
}
