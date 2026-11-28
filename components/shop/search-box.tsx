"use client";

import { ArrowRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { useAvisarFiltrando } from "@/components/shop/filtrando";
import {
  leerFiltrosDeTienda,
  parametrosDeLaDireccion,
  urlCambiando,
} from "@/modules/catalog/products/filtros-tienda";
import { TIPO_FILTRO } from "@/lib/transiciones";
import { cn } from "@/lib/utils";

/** Buscador (DESIGN-REFERENCE §6.2). */
export function SearchBox({
  className,
  autoFocus,
  placeholder = "Buscar productos...",
  conservarFiltros = false,
  seccion = null,
  principal = false,
  tamano = "normal",
}: {
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /**
   * El buscador de la página: mientras está a la vista, el del encabezado no
   * se dibuja (la regla está en `globals.css`).
   */
  principal?: boolean;
  /** `compacto` es el del encabezado. */
  tamano?: "normal" | "compacto";
  /**
   * Conserva los filtros puestos al buscar. Por omisión se descartan: en el
   * encabezado se busca para empezar, y arrastrarlos sería un filtro invisible.
   */
  conservarFiltros?: boolean;
  /** La categoría de la página, para buscar dentro de ella. */
  seccion?: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  useAvisarFiltrando(pendiente);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLFormElement>(null);
  const [valor, setValor] = useState(params.get("q") ?? "");
  const compacto = tamano === "compacto";

  // Avisa cuándo dejó de verse, para que vuelva el del encabezado. El atributo
  // va directo al DOM porque lo lee una regla de CSS: el scroll no renderiza.
  useEffect(() => {
    const el = caja.current;
    if (!principal || !el) return;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        el.toggleAttribute("data-fuera-de-vista", !entrada.isIntersecting);
      },
      { threshold: 0 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [principal]);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = valor.trim();

    if (!conservarFiltros) {
      router.push(q ? `/productos?q=${encodeURIComponent(q)}` : "/productos");
      return;
    }

    const actuales = leerFiltrosDeTienda(
      parametrosDeLaDireccion(params),
      seccion,
    );
    iniciar(() => {
      router.push(urlCambiando(actuales, { q }), {
        transitionTypes: TIPO_FILTRO,
      });
    });
  };

  const limpiar = () => {
    setValor("");
    input.current?.focus();
  };

  return (
    <form
      ref={caja}
      role="search"
      onSubmit={buscar}
      data-buscador-principal={principal ? "" : undefined}
      className={cn("relative w-full", className)}
    >
      <label htmlFor={id} className="sr-only">
        Buscar productos
      </label>
      <input
        id={id}
        ref={input}
        type="search"
        name="q"
        autoFocus={autoFocus}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "peer w-full rounded-pill border border-border bg-surface",
          "text-ink transition-colors duration-150",
          "placeholder:text-ink-secondary focus:border-border-strong",
          // `max-md:text-body`: iOS Safari amplía la página al enfocar un
          // campo de menos de 16px, y no lo deshace al salir.
          compacto
            ? "h-10 pl-4 text-body-sm max-md:text-body shadow-sm"
            : "h-12 pl-5 text-body",
          compacto
            ? valor
              ? "pr-[72px]"
              : "pr-11"
            : valor
              ? "pr-[88px]"
              : "pr-13",
          // La cruz nativa de `type=search` se cambia por un botón accesible.
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {valor && (
        <button
          type="button"
          onClick={limpiar}
          className={cn(
            "absolute top-1/2 grid -translate-y-1/2 place-items-center",
            "rounded-pill text-ink-tertiary transition-colors duration-150",
            "hover:bg-surface-sunken hover:text-ink",
            compacto ? "right-[42px] size-7" : "right-[52px] size-8",
          )}
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Limpiar la búsqueda</span>
        </button>
      )}

      <button
        type="submit"
        className={cn(
          "absolute top-1/2 right-1 grid -translate-y-1/2 place-items-center",
          "rounded-pill bg-brand text-ink-inverse shadow-brand",
          compacto ? "size-8" : "size-10 max-md:size-11",
          // `shadow-brand` pisa la del anillo: se vuelve a pedir.
          "focus-visible:shadow-focus",
          "transition-colors duration-150 hover:bg-brand-hover active:bg-brand-active",
        )}
      >
        <ArrowRight aria-hidden className="size-4" />
        <span className="sr-only">Buscar</span>
      </button>
    </form>
  );
}
