import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Botón — DESIGN-REFERENCE §6.3.
 *
 * Las variantes destructivas se separan de la de marca por FORMA, no por
 * color (§2.2): el burdeos y el rojo de peligro están a 7 grados de matiz.
 * `destructive` es contorno; `destructive-solid` es relleno y vive
 * únicamente dentro del diálogo de confirmación, donde no hay un botón de
 * marca al lado con el cual confundirlo.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "font-medium transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    // Deshabilitado: 40% de opacidad, sin cambiar de color (§6.3).
    "disabled:cursor-not-allowed disabled:opacity-40",
  ],
  {
    variants: {
      variant: {
        // Una sola por pantalla.
        brand:
          "bg-brand text-ink-inverse hover:bg-brand-hover active:bg-brand-active",
        secondary:
          "border border-border bg-surface text-ink hover:bg-surface-sunken hover:border-border-strong",
        tertiary: "bg-transparent text-ink-secondary hover:text-ink",
        destructive:
          "border border-danger bg-transparent text-danger hover:bg-danger-tint",
        "destructive-solid": "bg-danger text-white hover:opacity-90",
      },
      size: {
        // Tienda: píldora. Panel: 8px de radio (§3.5).
        sm: "h-8 rounded-pill px-3 text-body-sm admin:rounded-panel-control",
        md: "h-10 rounded-pill px-4 text-body-sm admin:rounded-panel-control",
        lg: "h-12 rounded-pill px-6 text-body admin:h-10 admin:rounded-panel-control admin:text-body-sm",
        // Cuadrado para acciones de solo ícono. 44px de área táctil en móvil (§9).
        icon: "size-11 rounded-pill admin:size-9 admin:rounded-panel-control",
      },
      emphasis: {
        // --shadow-brand: solo el envío del buscador y el principal del hero (§3.6).
        none: "",
        // La sombra propia pisa la del anillo de foco: se vuelve a pedir.
        glow: "shadow-brand focus-visible:shadow-focus",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
      emphasis: "none",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Reemplaza el texto por un indicador conservando el ancho del botón,
     * para que la interfaz no salte (§6.3).
     */
    loading?: boolean;
    /** Qué se está haciendo, para el lector de pantalla. */
    loadingLabel?: string;
  };

function Button({
  className,
  variant,
  size,
  emphasis,
  asChild = false,
  loading = false,
  loadingLabel = "Procesando",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, emphasis, className }))}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, emphasis, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* El contenido se mantiene en el flujo para conservar el ancho. */}
      <span
        className={cn(
          "inline-flex items-center gap-2",
          loading && "invisible",
        )}
      >
        {children}
      </span>
      {loading && (
        <span className="absolute inline-flex items-center gap-2">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          <span className="sr-only">{loadingLabel}</span>
        </span>
      )}
    </button>
  );
}

export { Button, buttonVariants };
