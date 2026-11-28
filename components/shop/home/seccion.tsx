import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

/**
 * La usan todas las secciones de la home y los recomendados de la ficha. El
 * enlace dice a dónde va para el lector de pantalla, que lo lee suelto.
 */
export function SeccionDeLaHome({
  titulo,
  enlace,
  accion,
  children,
}: {
  titulo: string;
  /** `texto` es lo que se ve; `etiqueta`, lo que oye el lector de pantalla. */
  enlace?: { href: string; etiqueta: string; texto?: string };
  /** Un control en el lugar del enlace, como «Borrar historial». */
  accion?: React.ReactNode;
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
            <span aria-hidden>{enlace.texto ?? "Ver todo"}</span>
            <span className="sr-only">{enlace.etiqueta}</span>
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}

        {accion}
      </div>

      {children}
    </section>
  );
}

/** La misma grilla del catálogo, para que las tarjetas pesen igual. */
export function GrillaDeLaHome({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </ul>
  );
}
