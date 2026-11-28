"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** El ancho de cada `<li>` del carrusel: el mismo de la grilla en cada tamaño. */
export const ANCHO_EN_CARRUSEL =
  "w-[42%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]";

/**
 * Repetida a propósito de la galería: importarla metería la galería en el
 * paquete del carrito. La regla de `prefers-reduced-motion` de `globals.css`
 * no alcanza al `behavior` que se pasa por JavaScript.
 */
function comoDesplazar(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
}

/**
 * Una fila de tarjetas que se desliza: con el dedo en el teléfono, con
 * flechas desde `md`. Las tarjetas entran como `children` y siguen siendo de
 * servidor. `-my-3 py-3`, para que la pista no recorte la sombra.
 */
export function Carrusel({ children }: { children: React.ReactNode }) {
  const pista = useRef<HTMLUListElement>(null);
  const [puntas, setPuntas] = useState({ inicio: true, fin: false });

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    // Con zoom, `scrollLeft` llega con decimales y la punta nunca da exacta.
    const inicio = el.scrollLeft <= 1;
    const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setPuntas((p) =>
      p.inicio === inicio && p.fin === fin ? p : { inicio, fin },
    );
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);

  const mover = (sentido: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: sentido * el.clientWidth, behavior: comoDesplazar() });
  };

  return (
    <div className="relative">
      <ul
        ref={pista}
        onScroll={medir}
        className={cn(
          "-mx-4 -my-3 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 py-3 scroll-px-4",
          "sm:-mx-6 sm:px-6 sm:scroll-px-6 lg:-mx-8 lg:px-8 lg:scroll-px-8",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {children}
      </ul>

      <Flecha
        hacia="anterior"
        disponible={!puntas.inicio}
        onClick={() => mover(-1)}
      />
      <Flecha
        hacia="siguiente"
        disponible={!puntas.fin}
        onClick={() => mover(1)}
      />
    </div>
  );
}

/** Mitad afuera de la pista: adentro taparía la foto de la primera tarjeta. */
function Flecha({
  hacia,
  disponible,
  onClick,
}: {
  hacia: "anterior" | "siguiente";
  disponible: boolean;
  onClick: () => void;
}) {
  const Icono = hacia === "anterior" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!disponible}
      className={cn(
        "absolute top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center md:flex",
        "rounded-pill bg-surface text-ink-secondary shadow-md",
        "transition-[color,opacity] duration-150 hover:text-ink",
        "disabled:pointer-events-none disabled:opacity-0",
        hacia === "anterior"
          ? "left-0 -translate-x-1/2"
          : "right-0 translate-x-1/2",
      )}
    >
      <Icono aria-hidden className="size-5" />
      <span className="sr-only">
        {hacia === "anterior" ? "Productos anteriores" : "Más productos"}
      </span>
    </button>
  );
}
