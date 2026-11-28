"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/**
 * Va por portal porque la tabla del panel scrollea sobre sí misma y su
 * `overflow` lo recortaría; por eso se lleva la escala puesta (`escala.tsx`).
 */
function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(
  props: React.ComponentProps<typeof PopoverPrimitive.Trigger>,
) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "end",
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        data-scale={useDataScale()}
        align={align}
        sideOffset={sideOffset}
        // Pegado al borde de la ventana el globo queda cortado.
        collisionPadding={12}
        className={cn(
          "z-50 w-72 rounded-panel-card border border-border bg-surface p-4 text-ink shadow-lg",
          "origin-[--radix-popover-content-transform-origin]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "duration-150",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
