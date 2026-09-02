import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campo de texto — DESIGN-REFERENCE §6.6.
 * 48px en la tienda, 40px en el panel. Píldora en la tienda, 8px en el panel.
 * El estado de error se marca con `aria-invalid`, que además lo anuncia
 * al lector de pantalla (§9).
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full rounded-pill border border-border bg-surface px-4 text-body text-ink",
        "transition-colors duration-150 outline-none",
        "placeholder:text-ink-tertiary",
        "focus:border-border-strong",
        "aria-invalid:border-danger",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-ink",
        "admin:h-10 admin:rounded-panel-control admin:px-3 admin:text-body-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Área de texto. Mismo contrato que Input, sin la píldora: es multilínea. */
function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-image border border-border bg-surface px-4 py-3 text-body text-ink",
        "transition-colors duration-150 outline-none field-sizing-content",
        "placeholder:text-ink-tertiary",
        "focus:border-border-strong",
        "aria-invalid:border-danger",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "admin:rounded-panel-control admin:px-3 admin:py-2 admin:text-body-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
