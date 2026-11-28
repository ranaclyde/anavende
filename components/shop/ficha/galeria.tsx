"use client";

import Image from "next/image";
import { useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { llegadaDeLaFoto } from "@/components/shop/foto-viajera";
import { Miniaturas, Visor } from "@/components/ui/visor-de-fotos";
import { cn } from "@/lib/utils";
import type { VarianteDeFicha } from "@/modules/catalog/products/ficha";

// Las miniaturas se dibujan siempre, aun con una sola foto: si la columna
// apareciera y desapareciera al cambiar de color, la foto se correría.

type Imagenes = VarianteDeFicha["imagenes"];

/**
 * La regla de `prefers-reduced-motion` de `globals.css` apaga `scroll-behavior`
 * de CSS, no el `behavior: "smooth"` que se pasa por JavaScript.
 */
export function comoDesplazar(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
}

export function Galeria({
  imagenes,
  indice,
  alt,
  color,
  pista,
  onScroll,
  onElegir,
  transicion,
}: {
  imagenes: Imagenes;
  indice: number;
  alt: string;
  color: string | null;
  pista: RefObject<HTMLUListElement | null>;
  onScroll: (i: number) => void;
  onElegir: (i: number) => void;
  /** El slug, para recibir en la primera foto la que viene de la tarjeta. */
  transicion: string;
}) {
  const [ampliada, setAmpliada] = useState(false);
  const actual = Math.min(indice, Math.max(0, imagenes.length - 1));

  if (imagenes.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-card bg-surface shadow-md">
        <p className="text-body-sm text-ink-secondary">
          Todavía no cargamos las fotos de este producto.
        </p>
      </div>
    );
  }

  const descripcion = color ? `${alt}, ${color.toLowerCase()}` : alt;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:gap-4">
      {/* Primera en el DOM: sin `flex-row-reverse`, que desacomoda el teclado. */}
      <Miniaturas
        imagenes={imagenes}
        actual={actual}
        descripcion={descripcion}
        onElegir={onElegir}
      />

      <div className="relative min-w-0 flex-1">
        <ul
          ref={pista}
          // En el teléfono la pista es la única forma de llegar a la segunda
          // foto con el teclado: los puntos son `aria-hidden`.
          tabIndex={0}
          aria-label={`Fotos de ${descripcion}`}
          // Sin `overscroll-x-contain`, el final de la tira arrastra la página.
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card bg-surface shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== indice) onScroll(i);
          }}
        >
          {imagenes.map((img, i) => {
            // El radio también acá: la foto que viaja se dibuja sin la pista.
            const foto = (
              <div className="relative aspect-square overflow-hidden rounded-card">
                <Image
                  src={img.grande}
                  alt={
                    img.alt ?? `${descripcion} (${i + 1} de ${imagenes.length})`
                  }
                  fill
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  // La primera es el LCP (TECHNICAL-SPEC §20). `fetchPriority`
                  // y no `preload`: React ya precarga toda imagen no diferida,
                  // y esto le pasa la prioridad alta a esa precarga.
                  loading={i === 0 ? "eager" : undefined}
                  fetchPriority={i === 0 ? "high" : undefined}
                  className="object-contain"
                />
              </div>
            );
            return (
              <li key={img.grande} className="w-full shrink-0 snap-center">
                {i === 0 ? (
                  <div {...llegadaDeLaFoto(transicion)}>{foto}</div>
                ) : (
                  foto
                )}
              </li>
            );
          })}
        </ul>

        {/*
          Solo en escritorio: en el teléfono el navegador ya amplía con los
          dedos. Un `<button>` para que entre en el recorrido de teclado.
        */}
        <button
          type="button"
          onClick={() => setAmpliada(true)}
          className="absolute inset-0 hidden cursor-zoom-in rounded-card md:block"
        >
          <span className="sr-only">Ver la foto en grande</span>
        </button>

        {imagenes.length > 1 ? (
          <>
            <Flecha
              hacia="anterior"
              disponible={actual > 0}
              onClick={() => onElegir(actual - 1)}
            />
            <Flecha
              hacia="siguiente"
              disponible={actual < imagenes.length - 1}
              onClick={() => onElegir(actual + 1)}
            />
          </>
        ) : null}

        {/* La fila se dibuja siempre, aun vacía, igual que las miniaturas. */}
        <div
          aria-hidden
          className="flex h-1.5 justify-center gap-1.5 pt-3 md:hidden"
        >
          {imagenes.length > 1
            ? imagenes.map((img, i) => (
                <span
                  key={img.grande}
                  className={cn(
                    "size-1.5 rounded-full transition-colors duration-150",
                    i === actual ? "bg-brand" : "bg-border-strong",
                  )}
                />
              ))
            : null}
        </div>
      </div>

      <Visor
        imagenes={imagenes}
        actual={actual}
        descripcion={descripcion}
        abierta={ampliada}
        onAbrir={setAmpliada}
        onElegir={onElegir}
      />
    </div>
  );
}

/**
 * Se apagan en las puntas en vez de dar la vuelta: con encastre, saltar de la
 * última a la primera arrastra la pista entera y se ve como un error.
 */
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
        "rounded-pill bg-surface/92 text-ink-secondary shadow-md",
        "transition-colors duration-150 hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-0",
        hacia === "anterior" ? "left-3" : "right-3",
      )}
    >
      <Icono aria-hidden className="size-5" />
      <span className="sr-only">
        {hacia === "anterior" ? "Foto anterior" : "Foto siguiente"}
      </span>
    </button>
  );
}
