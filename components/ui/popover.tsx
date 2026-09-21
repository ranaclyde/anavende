"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/**
 * Popover — el de shadcn sobre Radix, como el resto de los primitivos.
 *
 * **No es un diálogo, y la diferencia importa.** Un diálogo oscurece la
 * pantalla y se queda con el foco: sirve para decidir algo. Un popover queda
 * anclado a lo que lo abrió y deja ver el resto, que es lo que hace falta
 * cuando se repite la misma operación fila tras fila —reponer cinco productos
 * sin perder de vista cuáles faltan—.
 *
 * **Va por portal, y no es un lujo:** desde el 2026-09-21 la tabla del panel
 * scrollea sobre sí misma (§6.9), así que un globo posicionado adentro lo
 * recortaría el `overflow` de la tabla. Por el portal sale de ahí, y por eso
 * también se lleva la escala puesta: arriba de `body` ya no hay `data-scale`
 * (`escala.tsx`).
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
        // `collisionPadding`: pegado al borde de la ventana el globo queda
        // cortado, y acá adentro hay campos que se escriben.
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
