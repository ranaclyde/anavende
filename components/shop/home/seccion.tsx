import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

/**
 * Una sección de la home — RF-01, §7.1. Tarea F3.7.
 *
 * **Son todas la misma pieza**: las de categoría, «Destacados», «En oferta» y
 * la de «Más categorías» de abajo. Cinco encabezados escritos a mano eran
 * cinco tamaños de `h2` esperando a divergir, que es exactamente lo que el
 * repaso del panel encontró del otro lado (§6.9, 2026-09-21).
 *
 * **El enlace de la derecha dice a dónde va, no «ver más».** «Ver todos los
 * teclados» se entiende leído solo, que es como lo lee un lector de pantalla
 * cuando recorre los enlaces de la página; a la vista alcanza con la flecha.
 */
export function SeccionDeLaHome({
  titulo,
  enlace,
  children,
}: {
  titulo: string;
  /** A dónde lleva el «→». Sin esto la sección no ofrece salida. */
  enlace?: { href: string; etiqueta: string };
  children: React.ReactNode;
}) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h2 id={id} className="text-heading text-ink">
          {titulo}
        </h2>

        {enlace ? (
          <Link
            href={enlace.href}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-pill px-2 text-body-sm font-medium text-brand transition-colors duration-150 hover:text-brand-hover"
          >
            <span aria-hidden>Ver todo</span>
            <span className="sr-only">{enlace.etiqueta}</span>
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>

      {children}
    </section>
  );
}

/** La grilla de tarjetas: la misma del catálogo, para que pesen igual (§6.1). */
export function GrillaDeLaHome({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </ul>
  );
}
