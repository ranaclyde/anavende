import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Precio } from "@/components/shop/precio";
import { PuntosDeColor } from "@/components/shop/tarjeta-producto";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { urlDeImagen } from "@/modules/media/subir";
import type { Favorito } from "@/modules/users/favoritos/queries";

/**
 * Un favorito en la vista de lista — F5.4 (pedido del 2026-09-14).
 *
 * Dice lo mismo que la tarjeta en un renglón: miniatura de 80px como la del
 * carrito (§7.4), marca, nombre, precio, colores y estado. Toda la fila lleva
 * a la ficha con el mismo enlace estirado que la tarjeta, y el corazón queda
 * encima, fuera del ancla.
 *
 * **Lo que ya no se vende no muestra precio**, como en el carrito (F5.6): un
 * precio de algo que no se puede comprar no informa nada.
 */
export function RenglonDeFavorito({
  favorito: f,
  accionFavorito,
}: {
  favorito: Favorito;
  accionFavorito: ReactNode;
}) {
  const noDisponible = !f.activo;
  const sinStock = !noDisponible && f.disponible <= 0;

  // §9: producto, marca y color.
  const alt = `${f.nombre} ${f.marca}` + (f.color ? `, ${f.color.toLowerCase()}` : "");

  return (
    <article
      className={cn(
        "relative flex items-center gap-4 rounded-card bg-surface p-3 shadow-md sm:p-4",
        "has-[a:focus-visible]:shadow-focus transition-shadow duration-200",
        noDisponible ? "" : "hover:shadow-lg",
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-image bg-surface-sunken">
        {f.imagenKey ? (
          <Image
            src={urlDeImagen(f.imagenKey, "thumb")}
            alt={alt}
            fill
            sizes="80px"
            className={cn(
              "object-cover",
              sinStock ? "opacity-55" : "",
              noDisponible ? "opacity-55 grayscale" : "",
            )}
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
          {f.marca}
        </p>
        <h3 className="text-body-sm font-medium text-ink">
          {noDisponible ? (
            f.nombre
          ) : (
            <Link
              href={`/productos/${f.slug}`}
              className="line-clamp-2 after:absolute after:inset-0 after:rounded-card after:content-['']"
            >
              {f.nombre}
            </Link>
          )}
        </h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {noDisponible ? null : (
            <Precio precio={f.precio} descuento={f.descuento} precioFinal={f.precioFinal} />
          )}
          <PuntosDeColor colores={f.colores ?? []} />
          {noDisponible ? (
            <Badge tone="neutral">No disponible</Badge>
          ) : sinStock ? (
            <Badge tone="danger">Sin stock</Badge>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 shrink-0">{accionFavorito}</div>
    </article>
  );
}
