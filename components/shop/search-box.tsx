"use client";

import { ArrowRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Buscador — DESIGN-REFERENCE §6.2.
 *
 * El componente firmado del sistema. Alto 48px, píldora, 20px de padding a
 * la izquierda y 52px reservados a la derecha para el botón. El botón
 * circular burdeos lleva --shadow-brand: la elevación tiene el color de la
 * marca, y ese es el detalle que la referencia identifica como su firma.
 */
export function SearchBox({
  className,
  autoFocus,
  placeholder = "Buscar productos...",
}: {
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState(params.get("q") ?? "");

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = valor.trim();
    router.push(q ? `/productos?q=${encodeURIComponent(q)}` : "/productos");
  };

  const limpiar = () => {
    setValor("");
    input.current?.focus();
  };

  return (
    <form
      role="search"
      onSubmit={buscar}
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
          "peer h-12 w-full rounded-pill border border-border bg-surface",
          "pl-5 text-body text-ink transition-colors duration-150",
          "placeholder:text-ink-tertiary focus:border-border-strong",
          // 52px para el botón, más 36px cuando además está la «×».
          valor ? "pr-[88px]" : "pr-13",
          // El navegador dibuja su propia cruz en type=search: se retira,
          // porque acá la limpieza es un botón propio y accesible.
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {valor && (
        <button
          type="button"
          onClick={limpiar}
          className={cn(
            "absolute top-1/2 right-[52px] grid size-8 -translate-y-1/2 place-items-center",
            "rounded-pill text-ink-tertiary transition-colors duration-150",
            "hover:bg-surface-sunken hover:text-ink",
          )}
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Limpiar la búsqueda</span>
        </button>
      )}

      <button
        type="submit"
        className={cn(
          "absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center",
          "rounded-pill bg-brand text-ink-inverse shadow-brand",
          // La sombra propia pisa la del anillo: acá se vuelve a pedir.
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
