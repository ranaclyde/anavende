"use client";

/**
 * PRUEBA: lo que usa el hero de prueba (`prueba-heroes-referencias.tsx`) y
 * el selector para compararlo con el de hoy.
 */

import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const VUELTA_MS = 3500;

/**
 * La rotación, con el freno de WCAG 2.2.2: se pausa con el botón, fuera de
 * la pantalla no corre, y con «reducir movimiento» no arranca.
 */
export function useRotacion(cantidad: number) {
  const [indice, setIndice] = useState(0);
  const [quieto, setQuieto] = useState(false);
  const [detenido, setDetenido] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setQuieto(consulta.matches);
    leer();
    consulta.addEventListener("change", leer);
    return () => consulta.removeEventListener("change", leer);
  }, []);

  useEffect(() => {
    if (quieto || detenido || cantidad < 2) return;
    const reloj = setInterval(() => {
      if (!document.hidden) setIndice((n) => (n + 1) % cantidad);
    }, VUELTA_MS);
    return () => clearInterval(reloj);
  }, [quieto, detenido, cantidad]);

  return { indice, quieto, detenido, setDetenido };
}

export function BotonPausa({
  detenido,
  alternar,
  className,
}: {
  detenido: boolean;
  alternar: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={alternar}
      title={
        detenido ? "Reanudar el cambio de fotos" : "Pausar el cambio de fotos"
      }
      className={cn(
        "grid size-11 place-items-center rounded-pill bg-surface/90 text-ink-secondary shadow-sm transition-colors duration-150 hover:text-ink",
        className,
      )}
    >
      {detenido ? (
        <Play aria-hidden className="size-4" />
      ) : (
        <Pause aria-hidden className="size-4" />
      )}
      <span className="sr-only">
        {detenido ? "Reanudar el cambio de fotos" : "Pausar el cambio de fotos"}
      </span>
    </button>
  );
}

/* ───────────────────────── El selector de la prueba ───────────────────── */

export function SelectorDeHero({ actual }: { actual: string | null }) {
  const opciones = [
    { clave: null, texto: "Hoy", nombre: "" },
    { clave: "p", texto: "P", nombre: "Columnas" },
  ];
  return (
    <nav
      aria-label="Prueba de heros"
      className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] gap-1 overflow-x-auto rounded-pill border border-border bg-surface p-1 text-body-sm shadow-lg"
    >
      {opciones.map((o) => (
        <Link
          key={o.texto}
          href={o.clave ? `/?hero=${o.clave}` : "/"}
          aria-current={actual === o.clave ? "page" : undefined}
          className={cn(
            "rounded-pill px-3 py-2 font-medium text-ink-secondary hover:text-ink",
            actual === o.clave && "bg-ink text-white hover:text-white",
          )}
        >
          {o.texto}
          {o.nombre ? (
            <span className="max-sm:hidden"> · {o.nombre}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
