"use client";

import { ArrowRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  leerFiltrosDeTienda,
  urlCambiando,
} from "@/modules/catalog/products/filtros-tienda";
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
  conservarFiltros = false,
  principal = false,
  tamano = "normal",
}: {
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /**
   * Marca a ESTE buscador como el de la página (la home y el catálogo tienen
   * el suyo). Mientras está a la vista, el del encabezado no se dibuja: la
   * regla vive en `globals.css` y se resuelve en CSS, sin parpadeo.
   *
   * Al salir de la pantalla se marca solo, y ahí el del encabezado vuelve.
   */
  principal?: boolean;
  /** `compacto` es el del encabezado: 40px de alto en vez de 48 (§5.1). */
  tamano?: "normal" | "compacto";
  /**
   * Qué hacer con los filtros que ya están puestos al enviar.
   *
   * Por omisión se descartan, que es lo correcto en el encabezado: ahí se
   * busca para *empezar*, y arrastrar la marca de la pantalla anterior sería
   * un filtro invisible.
   *
   * En la barra del catálogo hace falta lo contrario. Buscar «teclado»
   * teniendo puesta una marca no puede borrarla: el chip está a la vista y la
   * persona espera que siga valiendo.
   *
   * Es una bandera y no un constructor de URL porque este componente es de
   * cliente y quien lo usa es de servidor: una función no cruza ese borde.
   */
  conservarFiltros?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLFormElement>(null);
  const [valor, setValor] = useState(params.get("q") ?? "");
  const compacto = tamano === "compacto";

  /*
   * Avisa cuándo este buscador dejó de verse, para que el del encabezado
   * ocupe su lugar. Un IntersectionObserver y no un umbral de scroll en
   * píxeles: el alto de la home y el del catálogo son distintos, y un número
   * fijo se rompe el día que cambie el encabezado de cualquiera de las dos.
   *
   * El atributo se escribe en el DOM en vez de pasar por estado de React
   * porque quien lo lee es una regla de CSS, no un componente. Así el scroll
   * no dispara un solo render.
   */
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

    // Se relee la URL en vez de recibir los filtros por prop: son los mismos
    // que la pantalla ya leyó, y una segunda copia viajando como prop es una
    // copia que se puede desincronizar. `urlCambiando` vuelve a la página 1,
    // que es justo lo que corresponde al cambiar la búsqueda.
    const actuales = leerFiltrosDeTienda(Object.fromEntries(params.entries()));
    router.push(urlCambiando(actuales, { q }));
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
          "placeholder:text-ink-tertiary focus:border-border-strong",
          // `max-md:text-body` no es una decisión de tipografía: iOS Safari
          // **hace zoom sobre la página** al enfocar un campo con menos de
          // 16px, y no lo deshace al salir. El comprador queda con la tienda
          // ampliada y desplazada después de escribir una palabra. En
          // escritorio siguen siendo los 14px del sistema.
          compacto
            ? "h-10 pl-4 text-body-sm max-md:text-body shadow-sm"
            : "h-12 pl-5 text-body",
          // Espacio para el botón, más el de la «×» cuando hay texto.
          compacto
            ? valor
              ? "pr-[72px]"
              : "pr-11"
            : valor
              ? "pr-[88px]"
              : "pr-13",
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
          compacto ? "size-8" : "size-10",
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
