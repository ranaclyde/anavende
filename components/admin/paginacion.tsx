import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Paginación del panel — §10.2. Tarea F7.1.
 *
 * **No es la de la tienda.** Aquélla dibuja un botón por página, que funciona
 * con un catálogo de unas pocas decenas de páginas y es lo que conviene ahí:
 * se salta a la 4 de un toque. Las órdenes se acumulan solas y sin techo, así
 * que a los dos años esa barra sería una tira de cien números — que además no
 * sirve de nada, porque nadie busca «la orden de la página 73»: para eso están
 * la búsqueda y el rango de fechas.
 *
 * Enlaces y no botones, igual que la de la tienda: cada página tiene su
 * dirección, se comparte y el atrás vuelve a la anterior.
 *
 * **Dice el tramo, no el número de página** (2026-11-03): «Del 41 al 80 de
 * 95 órdenes» ubica mejor que «Página 2 de 3», porque cuenta filas, que es lo
 * que se está mirando, y ya dice si hay más: el «al» llega o no al total. Las
 * dos juntas no entran a 390px sin partirse en varios renglones, y la segunda
 * no agregaba nada que la primera no dijera.
 *
 * El texto va al principio y los dos pasos juntos al final, también en el
 * orden del DOM: el lector oye dónde está antes de los enlaces para moverse.
 * Cuando no entran en un renglón —en el teléfono— los pasos bajan al
 * siguiente, a la derecha, y el texto no se aprieta.
 */
export function PaginacionDelPanel({
  pagina,
  paginas,
  total,
  porPagina,
  cosa,
  href,
}: {
  pagina: number;
  paginas: number;
  /** Cuántas filas hay en todo el listado, con los filtros aplicados. */
  total: number;
  porPagina: number;
  /** Lo que se lista, como lo nombra el contador de la pantalla. */
  cosa: { singular: string; plural: string };
  href: (n: number) => string;
}) {
  if (paginas <= 1) return null;

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1"
    >
      {/* `aria-live` no: la página cambia con una navegación, y el lector ya
          anuncia la pantalla nueva. */}
      <p className="text-body-sm text-ink-secondary tabular-nums">
        Del {desde} al {hasta} de {total}{" "}
        {total === 1 ? cosa.singular : cosa.plural}
      </p>

      <div className="ml-auto flex gap-2">
        <Paso
          href={href(pagina - 1)}
          hay={pagina > 1}
          etiqueta="Página anterior"
        >
          <ChevronLeft aria-hidden />
          Anterior
        </Paso>
        <Paso
          href={href(pagina + 1)}
          hay={pagina < paginas}
          etiqueta="Página siguiente"
        >
          Siguiente
          <ChevronRight aria-hidden />
        </Paso>
      </div>
    </nav>
  );
}

/**
 * Un paso, que en la primera y en la última página **no existe** en vez de
 * quedar apagado: un enlace deshabilitado no se puede enfocar ni explica por
 * qué no anda, y el «Del 81 al 95 de 95» de al lado ya dice dónde está el
 * límite. El hueco se conserva para que el otro paso no cambie de lugar.
 */
function Paso({
  href,
  hay,
  etiqueta,
  children,
}: {
  href: string;
  hay: boolean;
  etiqueta: string;
  children: React.ReactNode;
}) {
  if (!hay) return <span aria-hidden className="w-24" />;

  return (
    <Button asChild variant="secondary" size="sm" className="w-24">
      <Link href={href}>
        {children}
        <span className="sr-only">: {etiqueta}</span>
      </Link>
    </Button>
  );
}
