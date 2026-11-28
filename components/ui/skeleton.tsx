import { cn } from "@/lib/utils";

/**
 * Esqueleto de carga (DESIGN-REFERENCE §8): con la forma real del contenido,
 * para que la página no salte. Se apaga bajo `prefers-reduced-motion` por una
 * regla global en globals.css.
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
