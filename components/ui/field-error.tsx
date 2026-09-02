import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Mensaje de error de un campo — DESIGN-REFERENCE §6.6 y §9.
 * Lleva ícono además del color: el color nunca es el único portador de
 * información. `role="alert"` lo anuncia al lector de pantalla.
 */
export function FieldError({
  id,
  children,
  className,
}: {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;

  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-1.5 text-caption text-danger",
        className,
      )}
    >
      <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
