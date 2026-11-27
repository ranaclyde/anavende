"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Unos ocho renglones de `text-body-sm`. */
const PLEGADA = 160;

/** Lo que tiene que sobrar para que valga plegar: unos cuatro renglones. */
const MINIMO_ESCONDIDO = 80;

type Estado = "midiendo" | "corta" | "plegada" | "abierta";

/**
 * El contenido llega pintado desde el servidor: el Markdown es `server-only`.
 * Antes de medir ya se corta, para que una larga no salte al plegarse. El
 * texto escondido queda recortado, no se saca: el lector de pantalla lo lee.
 */
export function DescripcionPlegable({ children }: { children: ReactNode }) {
  const id = useId();
  const contenido = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<Estado>("midiendo");
  const [alto, setAlto] = useState(0);

  // Se vuelve a medir al cambiar el ancho o cargar la fuente.
  useEffect(() => {
    const nodo = contenido.current;
    if (!nodo) return;
    const medir = () => {
      const total = nodo.scrollHeight;
      setAlto(total);
      setEstado((antes) => {
        if (total <= PLEGADA + MINIMO_ESCONDIDO) return "corta";
        return antes === "abierta" ? "abierta" : "plegada";
      });
    };
    medir();
    const observador = new ResizeObserver(medir);
    // El hijo y no la caja: la caja tiene el alto recortado y no cambia.
    if (nodo.firstElementChild) observador.observe(nodo.firstElementChild);
    return () => observador.disconnect();
  }, []);

  const plegable = estado === "plegada" || estado === "abierta";

  function alternar() {
    if (estado === "abierta") {
      // Al plegar, si el comienzo ya salió de la pantalla, se vuelve a él.
      const seccion = contenido.current?.closest("section");
      if (seccion && seccion.getBoundingClientRect().top < 0) {
        const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
        seccion.scrollIntoView({
          block: "start",
          behavior: quieto ? "auto" : "smooth",
        });
      }
      setEstado("plegada");
    } else {
      setEstado("abierta");
    }
  }

  return (
    <>
      <div
        ref={contenido}
        id={id}
        style={{
          maxHeight:
            estado === "corta"
              ? undefined
              : estado === "abierta"
                ? alto
                : PLEGADA,
        }}
        className={cn(
          "overflow-hidden motion-safe:transition-[max-height] motion-safe:duration-300 motion-safe:ease-out",
          // Máscara y no degradado: no depende del color del fondo.
          estado === "plegada" &&
            "[mask-image:linear-gradient(to_bottom,black_55%,transparent)]",
        )}
      >
        {children}
      </div>

      {plegable ? (
        <Button
          type="button"
          variant="tertiary"
          // `-ml-4`: alinea el texto del botón con el de la descripción.
          className="-ml-4 mt-1 self-start"
          aria-expanded={estado === "abierta"}
          aria-controls={id}
          onClick={alternar}
        >
          {estado === "abierta" ? "Mostrar menos" : "Mostrar más"}
          <ChevronDown
            aria-hidden
            className={cn(
              "motion-safe:transition-transform motion-safe:duration-200",
              estado === "abierta" && "rotate-180",
            )}
          />
        </Button>
      ) : null}
    </>
  );
}
