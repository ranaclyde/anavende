"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { MedioDePagoDeLaHome } from "@/modules/catalog/products/home";

/**
 * Con `prefers-reduced-motion` la quieta la regla global de `globals.css`. El
 * botón de pausa es por WCAG 2.2.2. La lista va duplicada para que el bucle
 * empalme sin hueco; la copia es `aria-hidden`. Solo llegan los medios con
 * logo: lo filtra la consulta.
 */
export function HileraDePagos({ medios }: { medios: MedioDePagoDeLaHome[] }) {
  const [detenido, setDetenido] = useState(false);

  if (medios.length === 0) return null;

  const vuelta = [...medios, ...medios];

  return (
    <section aria-labelledby="medios-de-pago" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="medios-de-pago"
          className="text-caption font-medium tracking-wide text-ink-secondary uppercase"
        >
          Medios de pago
        </h2>
        <button
          type="button"
          onClick={() => setDetenido((v) => !v)}
          title={detenido ? "Reanudar el movimiento" : "Pausar el movimiento"}
          className="-my-3 grid size-11 place-items-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface hover:text-ink motion-reduce:hidden"
        >
          {detenido ? (
            <Play aria-hidden className="size-4" />
          ) : (
            <Pause aria-hidden className="size-4" />
          )}
          <span className="sr-only">
            {detenido
              ? "Reanudar el movimiento de los medios de pago"
              : "Pausar el movimiento de los medios de pago"}
          </span>
        </button>
      </div>

      {/* El degradado evita que los logos aparezcan de golpe en el borde. */}
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_3rem,black_calc(100%-3rem),transparent)]">
        <ul
          className={cn(
            "flex w-max animate-hilera items-center gap-3 hover:[animation-play-state:paused]",
            detenido && "[animation-play-state:paused]",
          )}
        >
          {vuelta.map((medio, i) => {
            const repetido = i >= medios.length;
            return (
              <li
                key={`${medio.id}-${i}`}
                aria-hidden={repetido || undefined}
                // No `--logo-chip`: es el mismo color del lienzo y no se vería.
                className="grid h-16 w-32 shrink-0 place-items-center rounded-image border border-border bg-surface px-4"
              >
                <Image
                  src={medio.logoUrl}
                  alt={repetido ? "" : medio.nombre}
                  width={96}
                  height={48}
                  className="h-10 w-full object-contain"
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
