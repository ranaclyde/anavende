import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { paginasALaVista } from "@/lib/paginacion";
import { cn } from "@/lib/utils";

/**
 * Paginación por enlaces — §10.2. Nació en el catálogo (F3.8), se comparte
 * con «Favoritos» desde F5.4, y desde el 2026-11-05 es **la única**: el panel
 * dejó la suya («Del 1 al 40 de 52» con anterior y siguiente) y usa esta. El
 * tramo pasó al contador de arriba de cada listado.
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
  className = "pt-10",
}: {
  pagina: number;
  paginas: number;
  href: (n: number) => string;
  /** El aire de arriba: la tienda deja 40px, el panel menos. */
  className?: string;
}) {
  if (paginas <= 1) return null;

  const numeros = paginasALaVista(pagina, paginas);

  return (
    <nav
      aria-label="Paginación"
      className={cn("flex justify-center", className)}
    >
      <ul className="flex flex-wrap items-center gap-1.5">
        {pagina > 1 ? (
          <li>
            <Flecha direccion="anterior" href={href(pagina - 1)} />
          </li>
        ) : null}
        {numeros.map((n, i) => {
          if (n === null) {
            return (
              // Decorativo: el lector ya oye «Página 1» y «Página 9».
              <li
                key={`salto-${i}`}
                aria-hidden
                className="grid size-11 place-items-center text-body-sm text-ink-secondary"
              >
                …
              </li>
            );
          }
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
        {pagina < paginas ? (
          <li>
            <Flecha direccion="siguiente" href={href(pagina + 1)} />
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/**
 * «Anterior» y «Siguiente», para avanzar de a una sin buscar el número.
 * Con la palabra al lado de la flecha (2026-11-04, pedido tuyo): una flecha
 * sola junto a una fila de números se confunde con un número más. En la
 * primera página no está «Anterior», y en la última no está «Siguiente»:
 * apagadas en gris parecían rotas.
 *
 * **En el teléfono queda solo la flecha**, con la palabra para el lector de
 * pantalla. Con las dos palabras, a 390px «Siguiente» bajaba sola a un
 * segundo renglón con apenas tres páginas.
 */
function Flecha({
  direccion,
  href,
}: {
  direccion: "anterior" | "siguiente";
  href: string;
}) {
  const anterior = direccion === "anterior";
  const Icono = anterior ? ChevronLeft : ChevronRight;

  return (
    <Button
      asChild
      variant="tertiary"
      // 44px de alto, como los números (§9). La tinta plena y no la
      // secundaria del terciario: es la acción de la fila.
      className="h-11 gap-1 px-3 text-ink max-sm:w-11 max-sm:px-0"
    >
      <Link href={href} rel={anterior ? "prev" : "next"}>
        {anterior ? <Icono aria-hidden className="size-4" /> : null}
        <span className="max-sm:sr-only">
          {anterior ? "Anterior" : "Siguiente"}
        </span>
        {anterior ? null : <Icono aria-hidden className="size-4" />}
      </Link>
    </Button>
  );
}
