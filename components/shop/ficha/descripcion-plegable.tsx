"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Alto de la descripción plegada: unos ocho renglones de `text-body-sm`, que
 * mide 20px de línea. Es lo que entra para saber de qué se trata sin tapar lo
 * que viene abajo (pedido tuyo del 2026-11-03).
 */
const PLEGADA = 160;

/**
 * Lo que tiene que sobrar para que valga plegar: unos cuatro renglones. Si
 * «Mostrar más» destapara uno o dos, sería un toque para nada. Una
 * descripción que se pasa por menos que esto se muestra entera.
 */
const MINIMO_ESCONDIDO = 80;

type Estado = "midiendo" | "corta" | "plegada" | "abierta";

/**
 * La descripción de la ficha, cortada con «Mostrar más» cuando es larga.
 *
 * **El contenido llega ya pintado desde el servidor** como `children`: el
 * Markdown es `server-only` y no cruza al navegador. Esta parte solo mide y
 * corta.
 *
 * Antes de medir, el corte se aplica igual pero sin el fundido ni el botón.
 * A una descripción corta no le cambia nada. A una larga la corta desde el
 * primer pintado, sin el salto de verla entera y después plegarse.
 *
 * **El texto escondido sigue en la página**: queda recortado, no se saca. Un
 * lector de pantalla lo lee entero, y el botón le dice con `aria-expanded` si
 * se ve o no. La descripción no admite enlaces, así que en la parte cortada no
 * hay nada que el Tab pueda enfocar sin que se vea.
 */
export function DescripcionPlegable({ children }: { children: ReactNode }) {
  const id = useId();
  const contenido = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<Estado>("midiendo");
  const [alto, setAlto] = useState(0);

  // Se vuelve a medir cuando cambia el ancho (girar el teléfono) o termina de
  // cargar la fuente: el mismo texto puede pasar de corto a largo.
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
    // Se observa el hijo y no la caja: la caja tiene el alto recortado y no
    // cambia cuando el texto crece.
    if (nodo.firstElementChild) observador.observe(nodo.firstElementChild);
    return () => observador.disconnect();
  }, []);

  const plegable = estado === "plegada" || estado === "abierta";

  function alternar() {
    if (estado === "abierta") {
      // Al plegar, el botón sube y quien estaba leyendo abajo queda en lo que
      // venía después. Si el comienzo ya salió de la pantalla, se vuelve a él.
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
          // El fundido es una máscara y no un degradado pintado: no depende
          // del color del fondo y en oscuro anda igual.
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
          // `-ml-4`: el texto del botón queda alineado con el de la
          // descripción, y el fondo del hover sale hacia el margen.
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
