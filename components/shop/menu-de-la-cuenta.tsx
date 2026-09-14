"use client";

import { Heart, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Las secciones de «Mi cuenta» — RF-07. Nace con F5.3 (2026-09-13).
 *
 * Solo las que existen: una entrada que lleva a una página vacía promete
 * algo que no hay. Favoritos llegó con F5.4; Compras se suma con F6.5.
 *
 * **En el teléfono es una barra de pestañas de ancho parejo** (2026-09-14):
 * ícono arriba, nombre abajo, y el ancho repartido entre las que haya. Era
 * una fila de pastillas que se deslizaba, y con la tercera entrada la activa
 * quedaba cortada en el borde sin nada que avisara que seguía. Se descartó
 * dejar que bajaran a una segunda fila: dos filas de navegación se leen
 * desordenadas. `grid-flow-col auto-cols-fr` reparte el ancho sin contar
 * entradas, así que Compras entra sola: con cuatro son unos 89px cada una,
 * y «Direcciones» sigue entrando.
 *
 * Desde `lg`, la columna al costado de siempre.
 *
 * Siguen siendo enlaces y no un componente de pestañas: cada sección es una
 * página con su propia dirección, y el atrás y los enlaces compartidos tienen
 * que funcionar.
 */
const SECCIONES = [
  { href: "/mi-cuenta", etiqueta: "Mis datos", Icono: UserRound },
  { href: "/mi-cuenta/direcciones", etiqueta: "Direcciones", Icono: MapPin },
  { href: "/mi-cuenta/favoritos", etiqueta: "Favoritos", Icono: Heart },
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
                  // Teléfono: la pestaña. 56px de alto, por encima de los
                  // 44 táctiles de §9.
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-image px-1 py-2 text-caption font-medium transition-colors duration-150",
                  // Desde `lg`: la pastilla de la columna, como era.
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
