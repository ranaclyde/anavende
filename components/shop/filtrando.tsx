"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Filtrar el catálogo, con movimiento (2026-10-20).
 *
 * **Mientras el servidor contesta, la grilla se atenúa**, y no se cambia por
 * un esqueleto: al filtrar se sigue mirando la misma lista, y la lista vieja
 * en pantalla es lo que deja que las tarjetas se deslicen a su lugar nuevo
 * cuando llega la respuesta (`app/(shop)/productos/page.tsx`). Con un
 * esqueleto en el medio, todas saldrían y volverían a entrar. El esqueleto es
 * para cuando no hay nada que mostrar todavía, como al abrir una ficha.
 *
 * Las navegaciones que filtran son varias y vienen de lugares distintos
 * —enlaces del servidor, el rango de precio, el orden, la búsqueda—, así que
 * cada una avisa acá y la grilla mira el total.
 */

let esperando = 0;
const oyentes = new Set<() => void>();

function avisar() {
  for (const o of oyentes) o();
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Cuenta una navegación de filtro mientras `pendiente` sea verdadero. */
export function useAvisarFiltrando(pendiente: boolean) {
  useEffect(() => {
    if (!pendiente) return;
    esperando++;
    avisar();
    return () => {
      esperando--;
      avisar();
    };
  }, [pendiente]);
}

/**
 * Va adentro de cada `Link` que filtra: `useLinkStatus` solo funciona desde
 * un descendiente del enlace. No dibuja nada.
 */
export function EsperaDelFiltro() {
  const { pending } = useLinkStatus();
  useAvisarFiltrando(pending);
  return null;
}

/**
 * La grilla de resultados. Se atenúa con un retraso de 150ms, para que una
 * respuesta rápida no la haga parpadear, y vuelve en el acto. `aria-busy`
 * para quien no la ve.
 */
export function GrillaQueEspera({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const filtrando = useSyncExternalStore(
    suscribir,
    () => esperando > 0,
    () => false,
  );

  return (
    <ul
      aria-busy={filtrando || undefined}
      className={cn(
        className,
        // La opacidad va en cada tarjeta y no en la lista: la foto que toma
        // la View Transition de cada una no incluye la opacidad de la lista,
        // y la tarjeta saltaría a opaca justo antes de moverse.
        "*:transition-opacity *:duration-150",
        filtrando && "*:opacity-60 *:delay-150",
      )}
    >
      {children}
    </ul>
  );
}
