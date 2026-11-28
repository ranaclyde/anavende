"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Mientras el servidor contesta un filtro, la grilla se atenúa y no se cambia
 * por un esqueleto: la lista vieja en pantalla es lo que deja que las
 * tarjetas se deslicen a su lugar nuevo. Cada navegación que filtra avisa acá.
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

/** Se atenúa con retraso, para que una respuesta rápida no la haga parpadear. */
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
        // En cada tarjeta y no en la lista: la View Transition de cada una no
        // incluye la opacidad de la lista, y saltaría a opaca antes de moverse.
        "*:transition-opacity *:duration-150",
        filtrando && "*:opacity-60 *:delay-150",
      )}
    >
      {children}
    </ul>
  );
}
