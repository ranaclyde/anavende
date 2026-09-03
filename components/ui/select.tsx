import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Selector de una opción — DESIGN-REFERENCE §6.6.
 *
 * Es el `<select>` del navegador y no un menú propio, a propósito: en el
 * teléfono abre la rueda nativa, que se maneja con el pulgar y ya sabe
 * escribir para buscar. Un menú hecho a mano tendría que reimplementar eso
 * —y el teclado, y el lector de pantalla— para verse igual.
 *
 * Comparte alto, radio, borde y anillo de foco con `Input`: en el formulario
 * van uno al lado del otro y cualquier diferencia se nota.
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
          "admin:h-10 admin:rounded-panel-control admin:pl-3 admin:text-body-sm",
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
