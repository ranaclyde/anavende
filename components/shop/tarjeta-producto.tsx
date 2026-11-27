import Image from "next/image";
import type { ReactNode } from "react";

import { EnlaceDeTarjeta } from "@/components/shop/foto-viajera";
import { Precio } from "@/components/shop/precio";
import { EsferaDeColor } from "@/components/ui/esfera-de-color";
import type { Money } from "@/lib/money";
import { urlDeImagen } from "@/modules/media/subir";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de producto (DESIGN-REFERENCE §6.1). Recibe un objeto plano y no una
 * fila de la base para que todas las pantallas usen la misma.
 *
 * Server Component a propósito: en una grilla de 24, hacerla cliente mandaría
 * 24 árboles a rehidratar. Lo interactivo entra por `accionFavorito`.
 */

export type ProductoEnTarjeta = {
  id: string;
  slug: string;
  nombre: string;
  marca: string;
  precio: Money;
  descuento: Money;
  precioFinal: Money;
  /**
   * Clave base en Storage, sin sufijo ni extensión, o `null` si el producto
   * todavía no tiene fotos (el alta es en dos pasos).
   */
  imagenKey: string | null;
  /** El de la foto que se muestra, para el texto alternativo. */
  color?: string | null;
  /** Todos los colores en que existe el producto. */
  colores?: { nombre: string; hex: string; hex2?: string | null }[];
  /** `stock_total − reserved_stock` sumado sobre las variantes. */
  disponible: number;
};

type Props = {
  producto: ProductoEnTarjeta;
  /**
   * El corazón de favoritos. Va como nodo y no como `onToggle` para que la
   * tarjeta siga siendo de servidor: la isla de cliente la arma quien la pasa.
   */
  accionFavorito?: ReactNode;
  /**
   * Un favorito que la vendedora desactivó: va **sin enlace**, porque la ficha
   * de un producto inactivo es un 404 (RN-05). El corazón queda para sacarlo.
   */
  noDisponible?: boolean;
  /**
   * Sin carga diferida, para la primera fila de una grilla (suele ser el LCP).
   * Sin `priority`: esa es solo para la foto principal de la ficha (TS §20), y
   * React ya precarga las imágenes no diferidas.
   */
  inmediata?: boolean;
};

export function TarjetaProducto({
  producto,
  accionFavorito,
  noDisponible = false,
  inmediata,
}: Props) {
  const { slug, nombre, marca, imagenKey, color, disponible } = producto;
  const colores = producto.colores ?? [];
  const sinStock = !noDisponible && disponible <= 0;
  const pildora = noDisponible
    ? "No disponible"
    : sinStock
      ? "Sin stock"
      : null;

  // Sin el color, dos tarjetas de la misma ficha se anuncian idénticas.
  const alt =
    [nombre, marca].join(" ") + (color ? `, ${color.toLowerCase()}` : "");

  return (
    <article
      className={cn(
        // `h-full`: sin esto, la de menos contenido queda más corta que su fila.
        "group relative flex h-full flex-col rounded-card bg-surface p-3",
        "shadow-md",
        // El foco se marca en la tarjeta: el enlace es solo el nombre.
        "has-[a:focus-visible]:shadow-focus",
        "transition-shadow duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        // Sin enlace, elevarse al pasar prometería uno.
        noDisponible
          ? ""
          : "hover:shadow-lg motion-safe:hover:-translate-y-0.5",
        // Única respuesta al toque en el teléfono. Mira el enlace y no la
        // tarjeta: apretar el corazón no la tiene que hundir.
        noDisponible
          ? ""
          : "motion-safe:has-[[data-enlace-tarjeta]:active]:scale-[0.98]",
        // `translate` y `scale`, no `transform`: Tailwind 4 mueve con esas dos.
        "motion-safe:transition-[box-shadow,translate,scale]",
      )}
    >
      <div className="relative overflow-hidden rounded-image bg-surface-sunken">
        {/* Aspecto reservado por CSS para que la grilla no salte (CLS). */}
        <div className="relative aspect-square">
          {imagenKey ? (
            <Image
              src={urlDeImagen(imagenKey, "card")}
              alt={alt}
              fill
              // Las columnas de la grilla: 2 / 3 / 4.
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              loading={inmediata ? "eager" : undefined}
              // La que viaja a la ficha. Lleva el radio porque viaja sin el
              // marco que la recorta.
              data-foto-tarjeta
              className={cn(
                "rounded-image object-cover",
                "motion-safe:transition-transform motion-safe:duration-200",
                "motion-safe:group-hover:scale-[1.03]",
                sinStock ? "opacity-55" : "",
                noDisponible ? "opacity-55 grayscale" : "",
              )}
            />
          ) : (
            <div
              className="flex h-full items-center justify-center"
              aria-hidden="true"
            >
              <span className="text-caption text-ink-secondary">Sin foto</span>
            </div>
          )}

          {/* Sin píldora de descuento: el tachado ya lo dice (RN-04c). */}
          {pildora ? (
            <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface/92 px-3 py-1.5 text-caption font-medium whitespace-nowrap text-ink shadow-md">
              {pildora}
            </p>
          ) : null}

          {/*
            Solo donde hay hover: sin él, un corazón invisible que igual se
            toca sería una trampa. Con teclado aparece con el foco.
          */}
          {accionFavorito ? (
            <div className="absolute top-2 right-2 z-10 hidden opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-150 [@media(hover:hover)]:block">
              {accionFavorito}
            </div>
          ) : null}

          <CantidadDeColores colores={colores} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-1 pt-3 pb-1">
        {/* Sin versalitas: se leía más importante que el nombre. */}
        <p className="-mb-1 text-caption text-ink-secondary">{marca}</p>

        <h3 className="text-body-sm font-medium text-ink">
          {/*
            Enlace estirado: envolver la tarjeta en un `<a>` metería el corazón
            dentro del enlace, que es HTML inválido.
          */}
          {noDisponible ? (
            <span className="line-clamp-2">{nombre}</span>
          ) : (
            <EnlaceDeTarjeta
              href={`/productos/${slug}`}
              slug={slug}
              className="line-clamp-2 after:absolute after:inset-0 after:rounded-card after:content-['']"
            >
              {nombre}
            </EnlaceDeTarjeta>
          )}
        </h3>

        {/* `mt-auto`: alinea los precios de la fila aunque los nombres no. */}
        <Precio
          precio={producto.precio}
          descuento={producto.descuento}
          precioFinal={producto.precioFinal}
          apilado
          className="mt-auto pt-1"
        />
      </div>
    </article>
  );
}

/**
 * Cuántos colores hay, sobre la foto; con uno solo, nada. La ruedita es un
 * arcoíris fijo a propósito: dice «hay más de un color», no cuáles.
 */
function CantidadDeColores({
  colores,
}: {
  colores: { nombre: string; hex: string; hex2?: string | null }[];
}) {
  if (colores.length < 2) return null;

  return (
    <p className="absolute bottom-2 left-2 flex items-center gap-1 rounded-pill bg-ink/75 py-0.5 pr-2 pl-1 text-caption font-medium text-ink-inverse tabular-nums">
      <span
        aria-hidden
        className="block size-3.5 rounded-full border border-ink-inverse/60"
        style={{ background: RUEDA }}
      />
      <span aria-hidden>{colores.length}</span>
      <span className="sr-only">
        En {colores.length} colores:{" "}
        {colores.map((c) => c.nombre.toLowerCase()).join(", ")}
      </span>
    </p>
  );
}

const RUEDA =
  "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)";

/**
 * Los colores como puntos, para el renglón de «Favoritos». No son
 * seleccionables: elegir color es de la ficha. Más de cuatro se resumen en «+N».
 */
export function PuntosDeColor({
  colores,
}: {
  colores: { nombre: string; hex: string; hex2?: string | null }[];
}) {
  if (colores.length === 0) return null;

  const MAXIMO = 4;
  const visibles = colores.slice(0, MAXIMO);
  const resto = colores.length - visibles.length;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* Puntos decorativos: los nombres los dice el texto oculto. */}
      {visibles.map((c) => (
        <EsferaDeColor
          key={c.hex + c.nombre}
          hex={c.hex}
          hex2={c.hex2}
          className="size-3"
        />
      ))}
      {resto > 0 ? (
        <span
          className="text-caption text-ink-secondary tabular-nums"
          aria-hidden="true"
        >
          +{resto}
        </span>
      ) : null}
      <span className="sr-only">
        {colores.length === 1
          ? `Color: ${colores[0].nombre.toLowerCase()}`
          : `Colores: ${colores.map((c) => c.nombre.toLowerCase()).join(", ")}`}
      </span>
    </div>
  );
}
