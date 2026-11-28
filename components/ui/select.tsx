import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * El `<select>` nativo, para listas cortas y cerradas: en el teléfono abre la
 * rueda del sistema. Las que crecen con el catálogo van en
 * `SelectorConBuscador`. Comparte alto, radio y borde con `Input`.
 */
function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-12 w-full appearance-none rounded-pill border border-border bg-surface",
          "pl-4 pr-10 text-body text-ink",
          "transition-colors duration-150",
          "focus:border-border-strong",
          "aria-invalid:border-danger",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "admin:h-10 admin:max-md:h-11 admin:rounded-panel-control admin:pl-3 admin:text-body-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-secondary admin:right-3"
      />
    </div>
  );
}

export { Select };
