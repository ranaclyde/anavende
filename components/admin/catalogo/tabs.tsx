"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Navegación entre marcas, categorías, colores y medios de pago — RF-18,
 * RF-19.
 *
 * Son rutas, no pestañas de cliente: así cada listado tiene su propia
 * dirección, el botón atrás funciona y cada uno se puede compartir.
 */
const SOLAPAS = [
  { href: "/admin/catalogo/marcas", etiqueta: "Marcas" },
  { href: "/admin/catalogo/categorias", etiqueta: "Categorías" },
  { href: "/admin/catalogo/colores", etiqueta: "Colores" },
  // Los medios de pago no son catálogo de productos, pero comparten pantalla
  // con él (§4): son las tablas que la vendedora carga una vez y toca cada
  // tanto. Una sección propia en el menú lateral para cuatro filas sería un
  // renglón más para leer en cada visita.
  { href: "/admin/catalogo/medios-de-pago", etiqueta: "Medios de pago" },
];

export function SolapasDeCatalogo() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones del catálogo"
      className="flex gap-1 border-b border-border"
    >
      {SOLAPAS.map(({ href, etiqueta }) => {
        const activa = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "-mb-px flex h-9 items-center rounded-t-panel-control px-3",
              "border-b-2 text-body-sm transition-colors duration-150",
              activa
                ? // Subrayado Y color: el estado no se comunica solo con
                  // color (§9).
                  "border-brand font-medium text-brand"
                : "border-transparent text-ink-secondary hover:text-ink",
            )}
          >
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
