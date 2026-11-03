"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * El acordeón de shadcn/ui (DR §12.2), sobre `@radix-ui/react-accordion`.
 * Se sumó el 2026-11-03 para los colores del producto en el panel.
 *
 * Radix pone el teclado (Enter y espacio abren y cierran; flechas, Inicio y
 * Fin pasan de uno a otro), el `aria-expanded` y el `aria-controls`.
 *
 * Tres cambios respecto del original:
 *
 * - **`AccordionHeader` va aparte del disparador.** En shadcn el disparador
 *   trae su encabezado adentro y ocupa la fila entera. Acá la fila puede
 *   llevar botones propios al lado (editar, sacar), y un botón no puede ir
 *   adentro de otro.
 * - **Sin el subrayado al pasar el puntero ni los colores de su tema:** usa
 *   los tokens del proyecto, y el foco es el anillo global de `globals.css`.
 * - **Sin la animación del alto.** Para animarlo, el contenido necesita
 *   `overflow-hidden` y eso recorta el anillo de foco de lo que está en el
 *   borde. Abre y cierra en el acto; la flecha es la que gira.
 */

function Accordion(
  props: React.ComponentProps<typeof AccordionPrimitive.Root>,
) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem(
  props: React.ComponentProps<typeof AccordionPrimitive.Item>,
) {
  return <AccordionPrimitive.Item data-slot="accordion-item" {...props} />;
}

function AccordionHeader({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Header>) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-header"
      className={cn("flex", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={cn(
        "flex flex-1 items-center justify-between gap-3 text-left disabled:pointer-events-none disabled:opacity-40",
        "[&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        aria-hidden
        className="pointer-events-none size-4 shrink-0 text-ink-secondary motion-safe:transition-transform motion-safe:duration-200"
      />
    </AccordionPrimitive.Trigger>
  );
}

function AccordionContent(
  props: React.ComponentProps<typeof AccordionPrimitive.Content>,
) {
  return (
    <AccordionPrimitive.Content data-slot="accordion-content" {...props} />
  );
}

export {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
};
