import Link from "next/link";

import { cn } from "@/lib/utils";

export type SolapaDelPanel = {
  href: string;
  etiqueta: string;
  activa: boolean;
  /** Cuántos hay de esto. Solo el segmentado lo dibuja. */
  cuantos?: number;
};

/**
 * Las solapas del panel — DR §6.9. Segmentado cuando cambia qué se ve del
 * mismo listado (con número); subrayado cuando cambia la pantalla (sin
 * número). Son enlaces: cada solapa tiene su dirección.
 */
export function SolapasDelPanel({
  etiqueta,
  variante,
  solapas,
  nombraElConteo,
}: {
  /** El `aria-label` del `<nav>`: qué elige esta tira. */
  etiqueta: string;
  variante: "segmentado" | "subrayado";
  solapas: readonly SolapaDelPanel[];
  /**
   * Cómo se lee el número en voz alta: «3 órdenes». El número suelto se
   * esconde de los lectores.
   */
  nombraElConteo?: (n: number) => string;
}) {
  const segmentado = variante === "segmentado";

  return (
    // En el teléfono, una sola tira que se desliza.
    <nav aria-label={etiqueta} className="max-w-full max-md:overflow-x-auto">
      <ul
        className={cn(
          "flex flex-wrap gap-1 max-md:flex-nowrap",
          segmentado
            ? "inline-flex rounded-panel-control bg-surface-sunken p-1"
            : "border-b border-border",
        )}
      >
        {solapas.map((solapa) => (
          <li key={solapa.href} className="shrink-0">
            <Link
              href={solapa.href}
              aria-current={solapa.activa ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3",
                "text-body-sm transition-colors duration-150",
                segmentado
                  ? cn(
                      // 44px abajo de `md`: es un enlace que se toca.
                      "h-8 max-md:h-11 rounded-panel-control",
                      solapa.activa
                        ? "bg-surface font-medium text-ink shadow-sm"
                        : "text-ink-secondary hover:text-ink",
                    )
                  : cn(
                      "-mb-px h-10 max-md:h-11 rounded-t-panel-control border-b-2",
                      solapa.activa
                        ? "border-brand font-medium text-brand"
                        : "border-transparent text-ink-secondary hover:text-ink",
                    ),
              )}
            >
              {solapa.etiqueta}
              {segmentado && solapa.cuantos !== undefined ? (
                <>
                  <span
                    aria-hidden
                    // El conteo pesa igual en la activa: un gris más claro no llega a AA.
                    className="text-caption tabular-nums text-ink-secondary"
                  >
                    {solapa.cuantos}
                  </span>
                  <span className="sr-only">
                    ({nombraElConteo?.(solapa.cuantos) ?? solapa.cuantos})
                  </span>
                </>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
