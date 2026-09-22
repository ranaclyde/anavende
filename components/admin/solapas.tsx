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
 * Las solapas del panel — DR §6.9.
 *
 * **Son dos formas, y la diferencia significa algo** (decisión tuya del
 * 2026-09-21). Hasta ese día existían las dos sin que nadie lo hubiera
 * escrito, así que divergían en todo lo demás —alto, color de la activa,
 * elemento contenedor— y parecían dos gustos en vez de dos trabajos:
 *
 * - **Segmentado**: cambia **qué se ve del mismo listado**. Píldora blanca
 *   sobre fondo hundido, porque se lee como «elegí uno de estos». **Lleva el
 *   número de cada una**, que es lo que contesta «¿tengo algo que hacer?» sin
 *   entrar. Órdenes y usuarios.
 * - **Subrayado**: cambia **en qué pantalla se está**. Se lee como «esta es
 *   la sección», igual que una pestaña de navegador. **No lleva número**: no
 *   hay un total que contestar, porque cada solapa es otra tabla. Catálogo.
 *
 * **Las dos miden 40px de alto**, para que el renglón no salte entre
 * pantallas: el segmentado son 4 + 32 + 4 y el subrayado es un ítem de 40 que
 * se apoya sobre el borde.
 *
 * **Son enlaces y no botones, y por eso esto no es un componente de cliente.**
 * Cada solapa tiene su dirección: se comparte, se abre en otra pestaña y el
 * botón atrás vuelve a la anterior. Con botones habría que reimplementar las
 * tres cosas y mandar JavaScript para algo que el navegador ya sabe hacer.
 *
 * **La activa se marca con forma y peso, no solo con color** (§9): pastilla y
 * medium en el segmentado, subrayado y medium en el otro.
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
   * Cómo se lee el número en voz alta: «3 órdenes», «1 persona». El número
   * suelto se esconde de los lectores, que si no leen «Activas 10» sin decir
   * diez qué.
   */
  nombraElConteo?: (n: number) => string;
}) {
  const segmentado = variante === "segmentado";

  return (
    <nav aria-label={etiqueta}>
      <ul
        className={cn(
          "flex flex-wrap gap-1",
          segmentado
            ? "inline-flex rounded-panel-control bg-surface-sunken p-1"
            : "border-b border-border",
        )}
      >
        {solapas.map((solapa) => (
          <li key={solapa.href}>
            <Link
              href={solapa.href}
              aria-current={solapa.activa ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3",
                "text-body-sm transition-colors duration-150",
                segmentado
                  ? cn(
                      "h-8 rounded-panel-control",
                      solapa.activa
                        ? "bg-surface font-medium text-ink shadow-sm"
                        : "text-ink-secondary hover:text-ink",
                    )
                  : cn(
                      "-mb-px h-10 rounded-t-panel-control border-b-2",
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
                    className={cn(
                      "text-caption tabular-nums",
                      solapa.activa
                        ? "text-ink-secondary"
                        : "text-ink-tertiary",
                    )}
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
