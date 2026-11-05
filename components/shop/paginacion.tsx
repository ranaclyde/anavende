import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
        <li>
          <Flecha
            direccion="anterior"
            href={pagina > 1 ? href(pagina - 1) : null}
          />
        </li>
        {numeros.map((n) => {
          const actual = n === pagina;
          return (
            <li key={n}>
              <Button
                asChild
                // `size="icon"` ya son los 44px de área táctil de §9: en un
                // teléfono, números de 28px uno al lado del otro se tocan mal
                // y se erra de página.
                size="icon"
                variant="tertiary"
                className={cn(
                  "tabular-nums",
                  // **La actual va con tinte y no con relleno de marca**
                  // (2026-11-04, pedido tuyo). El relleno burdeos es la cara
                  // del botón principal, y un estado con esa cara se lee como
                  // una acción. Es el mismo tinte de los chips elegidos de los
                  // filtros: «acá estás».
                  actual &&
                    "border border-brand-tint-border bg-brand-tint font-medium text-brand hover:bg-brand-tint hover:text-brand",
                )}
              >
                <Link href={href(n)} aria-current={actual ? "page" : undefined}>
                  {/*
                    Se lee «Página 2». Antes decía «2 Ir a la página 2», con el
                    número dos veces, y la actual «1 (página actual)», que
                    `aria-current` ya anuncia por su cuenta.
                  */}
                  <span className="sr-only">Página </span>
                  {n}
                </Link>
              </Button>
            </li>
          );
        })}
        <li>
          <Flecha
            direccion="siguiente"
            href={pagina < paginas ? href(pagina + 1) : null}
          />
        </li>
      </ul>
    </nav>
  );
}

/**
 * «Página anterior» y «Página siguiente», para avanzar de a una sin buscar el
 * número. En la primera y en la última se dibujan apagadas en vez de
 * desaparecer: si no, los números se corren al cambiar de página. Apagadas
 * no son un enlace ni se recorren con Tab, y el lector no las anuncia:
 * llevar a ningún lado no es una opción.
 */
function Flecha({
  direccion,
  href,
}: {
  direccion: "anterior" | "siguiente";
  href: string | null;
}) {
  const Icono = direccion === "anterior" ? ChevronLeft : ChevronRight;
  const icono = <Icono aria-hidden className="size-5" />;

  if (href === null) {
    return (
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center text-ink-secondary opacity-40"
      >
        {icono}
      </span>
    );
  }

  return (
    <Button asChild size="icon" variant="tertiary">
      <Link href={href} rel={direccion === "anterior" ? "prev" : "next"}>
        {icono}
        <span className="sr-only">
          {direccion === "anterior" ? "Página anterior" : "Página siguiente"}
        </span>
      </Link>
    </Button>
  );
}
