import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { visiblePages } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Paginación por enlaces y no botones (DR §10.2): cada página tiene su
 * dirección, se comparte y el atrás funciona. `href` arma la de cada página
 * con los filtros de la pantalla.
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

  const numeros = visiblePages(pagina, paginas);

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
                // `icon` son los 44px de área táctil de §9.
                size="icon"
                variant="tertiary"
                className={cn(
                  "tabular-nums",
                  // Tinte y no relleno de marca: con relleno se leería como acción.
                  actual &&
                    "border border-brand-tint-border bg-brand-tint font-medium text-brand hover:bg-brand-tint hover:text-brand",
                )}
              >
                <Link href={href(n)} aria-current={actual ? "page" : undefined}>
                  {/* Se lee «Página 2»; la actual la anuncia `aria-current`. */}
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
 * En el teléfono queda solo la flecha, con la palabra en `sr-only`: con las
 * dos palabras, a 390px «Siguiente» bajaba a un segundo renglón.
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
      // 44px de alto, como los números (§9).
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
