import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/** Lleva ícono además del color: el color nunca es la única señal (DR §9). */
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
