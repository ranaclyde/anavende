import { cn } from "@/lib/utils";

/**
 * Esqueleto de carga — DESIGN-REFERENCE §8.
 * Tiene la FORMA REAL del contenido, no es un spinner centrado: la página
 * no debe saltar cuando llegan los datos. Se apaga bajo
 * `prefers-reduced-motion` (regla global en globals.css).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-pulse rounded-image bg-surface-sunken",
        "admin:rounded-panel-image",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
