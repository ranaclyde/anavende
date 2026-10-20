/**
 * Los tipos de View Transition de la tienda (2026-10-20), que viajan con la
 * navegación (`transitionTypes` de `Link` y de `router`) y deciden qué se
 * anima.
 *
 * Viven acá y no en el módulo de cliente que los usa: un componente de
 * servidor que importa una constante de un archivo `"use client"` recibe una
 * referencia de cliente, no el valor.
 */

/**
 * Filtrar, ordenar y buscar dentro del catálogo: la grilla reacomoda sus
 * tarjetas (`app/(shop)/productos/page.tsx`). La paginación no lo lleva, y
 * tocar una tarjeta tampoco: ahí la que vuela es la foto
 * (`components/shop/foto-viajera.tsx`).
 */
export const TIPO_FILTRO = ["filtro"];
