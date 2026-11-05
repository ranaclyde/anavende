"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

/**
 * Slider de shadcn/ui sobre Radix (2026-11-04, para el rango de precio de los
 * filtros). Con dos valores dibuja dos manijas. Radix trae el teclado
 * —flechas, Inicio, Fin, Re Pág— y el rol `slider` con su valor; cada manija
 * necesita su propio nombre, que se pasa en `etiquetas`.
 */
function Slider({
  className,
  etiquetas,
  value,
  defaultValue,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** El nombre de cada manija para el lector de pantalla, en orden. */
  etiquetas: string[];
}) {
  const valores = value ?? defaultValue ?? [];

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        "data-[disabled]:opacity-50",
        // 44px de alto: el área táctil de §9 para arrastrar las manijas.
        "h-11",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1 w-full grow overflow-hidden rounded-full bg-border"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full bg-brand"
        />
      </SliderPrimitive.Track>
      {valores.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          data-slot="slider-thumb"
          aria-label={etiquetas[i]}
          className={cn(
            "block size-5 shrink-0 cursor-grab rounded-full border-2 border-brand bg-surface shadow-sm",
            "transition-shadow duration-150 active:cursor-grabbing",
            "focus-visible:shadow-focus focus-visible:outline-none",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
