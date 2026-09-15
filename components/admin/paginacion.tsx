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
 */
export function PaginacionDelPanel({
  pagina,
  paginas,
  href,
}: {
  pagina: number;
  paginas: number;
  href: (n: number) => string;
}) {
  if (paginas <= 1) return null;

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-3 pt-1"
    >
      <Paso href={href(pagina - 1)} hay={pagina > 1} etiqueta="Página anterior">
        <ChevronLeft aria-hidden />
        Anterior
      </Paso>

      {/* `aria-live` no: la página cambia con una navegación, y el lector ya
          anuncia la pantalla nueva. */}
      <p className="text-body-sm text-ink-secondary tabular-nums">
        Página {pagina} de {paginas}
      </p>

      <Paso
        href={href(pagina + 1)}
        hay={pagina < paginas}
        etiqueta="Página siguiente"
      >
        Siguiente
        <ChevronRight aria-hidden />
      </Paso>
    </nav>
  );
}

/**
 * Un paso, que en la primera y en la última página **no existe** en vez de
 * quedar apagado: un enlace deshabilitado no se puede enfocar ni explica por
 * qué no anda, y el «Página 1 de 5» de al lado ya dice dónde está el límite.
 * El hueco se conserva para que el texto del medio no se mueva.
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
