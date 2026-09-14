import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Paginación por enlaces — §10.2. Nació en el catálogo (F3.8) y se comparte
 * con «Favoritos» desde F5.4.
 *
 * Enlaces y no botones: cada página tiene su propia dirección, así que se
 * comparte, se abre en otra pestaña y el atrás vuelve a la anterior. Con
 * botones habría que reimplementar las tres cosas.
 *
 * `href` arma la dirección de cada página: el catálogo conserva sus filtros,
 * y cada pantalla sabe cuáles son los suyos.
 */
export function Paginacion({
  pagina,
  paginas,
  href,
}: {
  pagina: number;
  paginas: number;
  href: (n: number) => string;
}) {
  if (paginas <= 1) return null;

  const numeros = Array.from({ length: paginas }, (_, i) => i + 1);

  return (
    <nav aria-label="Paginación" className="flex justify-center pt-10">
      <ul className="flex flex-wrap items-center gap-1.5">
        {numeros.map((n) => (
          <li key={n}>
            <Button
              asChild
              // `size="icon"` ya son los 44px de área táctil de §9: en un
              // teléfono, números de 28px uno al lado del otro se tocan mal y
              // se erra de página.
              size="icon"
              variant={n === pagina ? "brand" : "tertiary"}
              className={cn(
                "tabular-nums",
                n === pagina ? "font-medium" : "hover:bg-surface-sunken",
              )}
            >
              <Link
                href={href(n)}
                aria-current={n === pagina ? "page" : undefined}
              >
                {n}
                <span className="sr-only">
                  {n === pagina ? " (página actual)" : ` Ir a la página ${n}`}
                </span>
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
