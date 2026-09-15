"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/**
 * Tooltip — el de shadcn sobre Radix, como el resto de los primitivos
 * (`@radix-ui/react-*`, uno por componente). Llegó con F5.4 para los botones
 * que son solo un ícono: el `title` nativo tarda en aparecer y se va apenas se
 * mueve el mouse, así que en la práctica no se ve.
 *
 * **No reemplaza la etiqueta.** El nombre accesible sigue en el botón (texto
 * `sr-only`): el tooltip es para quien ve el ícono y no lo reconoce, y en un
 * teléfono, donde no hay hover, no aparece.
 *
 * En tinta y con texto claro, como la franja de tienda cerrada: es lo único
 * oscuro que flota sobre una tienda clara, y se distingue sin sumar un color.
 */

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>,
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        // Los globos de ayuda viven hoy en la tienda, así que esto no cambia
        // nada todavía. Va igual porque el que falta es el que se olvida: si
        // mañana aparece uno en el panel, tiene que nacer bien (`escala.tsx`).
        data-scale={useDataScale()}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit rounded-[6px] bg-ink px-2.5 py-1.5 text-caption text-balance text-ink-inverse shadow-md",
          "origin-[--radix-tooltip-content-transform-origin] animate-in fade-in-0 zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-ink fill-ink" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
