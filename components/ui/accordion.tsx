"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * El acordeón de shadcn con dos cambios:
 * - `AccordionHeader` va aparte del disparador, para que la fila lleve sus
 *   propios botones al lado (un botón no puede ir adentro de otro).
 * - Sin animación del alto: necesitaría `overflow-hidden`, que recorta el
 *   anillo de foco de lo que está en el borde.
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
