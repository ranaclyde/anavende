"use client";

import { Heart, MapPin, Package, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Las secciones de «Mi cuenta» (RF-07): pestañas de ancho parejo en el
 * teléfono y columna desde `lg`. Enlaces y no un componente de pestañas:
 * cada sección es una página con su dirección.
 */
const SECCIONES = [
  { href: "/mi-cuenta", etiqueta: "Mis datos", Icono: UserRound },
  { href: "/mi-cuenta/direcciones", etiqueta: "Direcciones", Icono: MapPin },
  { href: "/mi-cuenta/favoritos", etiqueta: "Favoritos", Icono: Heart },
  { href: "/mi-cuenta/compras", etiqueta: "Compras", Icono: Package },
] as const;

export function MenuDeLaCuenta() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de tu cuenta">
      <ul className="grid auto-cols-fr grid-flow-col gap-1 rounded-card bg-surface-sunken p-1 lg:flex lg:flex-col lg:rounded-none lg:bg-transparent lg:p-0">
        {SECCIONES.map(({ href, etiqueta, Icono }) => {
          // «Mis datos» es la raíz: con `startsWith` estaría activa siempre.
          const activa =
            href === "/mi-cuenta"
              ? pathname === href
              : pathname.startsWith(href);

          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-image px-1 py-2 text-caption font-medium transition-colors duration-150",
                  "lg:h-11 lg:min-h-0 lg:flex-row lg:justify-start lg:gap-2 lg:rounded-pill lg:border lg:px-4 lg:py-0 lg:text-body-sm",
                  activa
                    ? "bg-surface text-ink shadow-sm lg:border-border lg:shadow-none"
                    : "text-ink-secondary hover:text-ink lg:border-transparent lg:hover:bg-surface",
                )}
              >
                <Icono aria-hidden className="size-5 shrink-0 lg:size-4" />
                <span className="max-w-full truncate">{etiqueta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
