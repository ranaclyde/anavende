import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cantidadDeProductos } from "@/modules/catalog/products/categorias";
import { urlDeCategoria } from "@/modules/catalog/products/filtros-tienda";

/**
 * Las tarjetas de categoría (DR §7.1 y §7.6): la cuadrada, para la home y las
 * destacadas, y la en fila, para la lista de la A a la Z, donde el nombre
 * necesita más ancho. Sin estado: sirven en servidor y en cliente.
 */

type Categoria = {
  slug: string;
  nombre: string;
};

/** El recuadro hundido con la inicial, para la que no tiene imagen. */
function Inicial({ nombre, className }: { nombre: string; className: string }) {
  return (
    <span aria-hidden className={className}>
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}

export function TarjetaCuadradaDeCategoria({
  categoria,
  imagenUrl,
  sizes,
  cantidad,
}: {
  categoria: Categoria;
  imagenUrl: string | null;
  /** El de cada grilla: no la dibujan todas del mismo ancho. */
  sizes: string;
  /** Solo en la página de categorías; la home no la muestra. */
  cantidad?: number;
}) {
  return (
    <Link
      href={urlDeCategoria(categoria.slug)}
      className="group flex h-full flex-col gap-2 rounded-card bg-surface p-2 shadow-md transition-shadow duration-200 hover:shadow-lg focus-visible:shadow-focus focus-visible:outline-none"
    >
      {/* Aspecto reservado por CSS, para que la fila no salte (CLS). */}
      <span className="relative grid aspect-square place-items-center overflow-hidden rounded-image bg-surface-sunken">
        {imagenUrl ? (
          // Decorativa: el nombre ya va debajo, en texto.
          <Image
            src={imagenUrl}
            alt=""
            fill
            sizes={sizes}
            className="object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <Inicial
            nombre={categoria.nombre}
            className="text-heading text-ink-tertiary"
          />
        )}
      </span>
      {cantidad === undefined ? (
        <span className="px-1 pb-1 text-body-sm font-medium break-words hyphens-auto text-ink transition-colors duration-150 group-hover:text-brand">
          {categoria.nombre}
        </span>
      ) : (
        <span className="flex flex-col gap-0.5 px-1 pb-1">
          <span className="text-body-sm font-medium break-words hyphens-auto text-ink transition-colors duration-150 group-hover:text-brand">
            {categoria.nombre}
          </span>
          <span className="text-caption text-ink-secondary">
            {cantidadDeProductos(cantidad)}
          </span>
        </span>
      )}
    </Link>
  );
}

/**
 * La fila de tarjetas cuadradas: en el teléfono se desliza, con la tercera
 * asomada; desde `sm`, la grilla de `grilla` (clases enteras, para que
 * Tailwind las encuentre). `-my-3 py-3`, para que no se recorte la sombra.
 */
export function FilaDeCategorias({
  grilla,
  children,
}: {
  grilla: string;
  children: React.ReactNode;
}) {
  return (
    <ul
      className={`-mx-4 -my-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 py-3 scroll-px-4 [scrollbar-width:none] sm:mx-0 sm:my-0 sm:grid sm:overflow-visible sm:p-0 [&::-webkit-scrollbar]:hidden ${grilla}`}
    >
      {children}
    </ul>
  );
}

/** El ancho de cada `<li>` en la fila: 40% asoma un tercio de la tercera. */
export const ANCHO_EN_FILA_DE_CATEGORIAS =
  "w-[40%] shrink-0 snap-start sm:w-auto";

/** La tarjeta en fila: un enlace entero al catálogo de la categoría. */
export function TarjetaEnFilaDeCategoria({
  categoria,
  miniaturaUrl,
  cantidad,
}: {
  categoria: Categoria;
  miniaturaUrl: string | null;
  cantidad: number;
}) {
  return (
    <Link
      href={urlDeCategoria(categoria.slug)}
      className="group flex h-full min-h-18 items-center gap-4 rounded-card bg-surface p-2 pr-4 shadow-md transition-shadow duration-200 hover:shadow-lg focus-visible:shadow-focus focus-visible:outline-none"
    >
      <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-image bg-surface-sunken">
        {miniaturaUrl ? (
          <Image
            src={miniaturaUrl}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <Inicial
            nombre={categoria.nombre}
            className="text-body font-medium text-ink-tertiary"
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Sin tope de renglones: cortar escondería lo que distingue dos nombres. */}
        <span className="text-body font-medium break-words text-ink transition-colors duration-150 group-hover:text-brand">
          {categoria.nombre}
        </span>
        <span className="text-body-sm text-ink-secondary">
          {cantidadDeProductos(cantidad)}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 text-ink-tertiary transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
      />
    </Link>
  );
}
