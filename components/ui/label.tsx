"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

/**
 * Etiqueta de campo — DESIGN-REFERENCE §6.6.
 * `body-sm` peso 500, SIEMPRE visible arriba del campo. No hay etiquetas
 * flotantes. Lo que se marca es lo opcional, no lo obligatorio.
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-body-sm font-medium text-ink",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

/** Texto de ayuda bajo el campo: caption, secundario (§6.6). */
function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-caption text-ink-secondary", className)}
      {...props}
    />
  );
}

export { Label, FieldHint };
