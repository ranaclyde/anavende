import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Etiqueta de estado (DR §6.4). Toda etiqueta lleva texto: el color nunca es
 * la única señal (§9, RNF-02), por eso no hay modo «solo punto de color».
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-caption font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        /** Orden activa. */
        info: "bg-info-tint text-info",
        /** Orden finalizada. */
        success: "bg-success-tint text-success",
        /** Origen manual · stock bajo. */
        warning: "bg-warning-tint text-warning",
        /** Sin stock · usuario bloqueado. */
        danger: "bg-danger-tint text-danger",
        /** Orden cancelada · producto inactivo · cuenta dada de baja. */
        neutral: "bg-surface-sunken text-ink-secondary",
        /** Identidad: destacado, oferta. */
        brand: "bg-brand-tint text-brand",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
