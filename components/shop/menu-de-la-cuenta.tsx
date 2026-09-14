"use client";

import { MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Las secciones de «Mi cuenta» — RF-07. Nace con F5.3 (2026-09-13).
 *
 * Solo las que existen: una entrada que lleva a una página vacía promete
 * algo que no hay. Compras y Favoritos se suman con F6.5 y F5.4.
 *
 * Al costado desde `lg`; arriba y en fila en el teléfono, donde una columna
 * de enlaces empujaría el contenido fuera de la pantalla.
 */
const SECCIONES = [
  { href: "/mi-cuenta", etiqueta: "Mis datos", Icono: UserRound },
  { href: "/mi-cuenta/direcciones", etiqueta: "Direcciones", Icono: MapPin },
] as const;

export function MenuDeLaCuenta() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de tu cuenta">
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
        {SECCIONES.map(({ href, etiqueta, Icono }) => {
          // «Mis datos» es la raíz: con `startsWith` estaría activa siempre.
          const activa =
            href === "/mi-cuenta"
              ? pathname === href
              : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 whitespace-nowrap rounded-pill border px-4 text-body-sm font-medium transition-colors duration-150",
                  activa
                    ? "border-border bg-surface text-ink"
                    : "border-transparent text-ink-secondary hover:bg-surface hover:text-ink",
                )}
              >
                <Icono aria-hidden className="size-4" />
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
