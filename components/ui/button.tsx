import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Botón (DR §6.3). Lo destructivo se separa de la marca por forma y no por
 * color: el burdeos y el rojo están a 7 grados de matiz. `destructive-solid`
 * va solo en el diálogo de confirmación.
 *
 * `whatsapp` y `pizarra` pesan lo mismo que `brand`, como su par; lo que debe
 * pesar menos va en `secondary`.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "font-medium transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "disabled:cursor-not-allowed disabled:opacity-40",
  ],
  {
    variants: {
      variant: {
        brand:
          "bg-brand text-ink-inverse hover:bg-brand-hover active:bg-brand-active",
        whatsapp:
          "bg-whatsapp text-ink-inverse hover:bg-whatsapp-hover active:bg-whatsapp-active [&_svg]:text-current",
        pizarra:
          "bg-accent text-ink-inverse hover:bg-accent-hover active:bg-accent-active",
        secondary:
          "border border-border bg-surface text-ink hover:bg-surface-sunken hover:border-border-strong",
        tertiary:
          "bg-transparent text-ink-secondary hover:bg-canvas hover:text-ink active:bg-border",
        destructive:
          "border border-danger bg-transparent text-danger hover:bg-danger-tint",
        // Solo el panel, en columnas de acciones: rojo desde el reposo,
        // porque en táctil no hay hover.
        "destructive-ghost":
          "bg-transparent text-danger hover:bg-danger-tint active:bg-danger-tint",
        // `text-ink-inverse` y no `text-white`: en oscuro el blanco sobre
        // `--danger` da 2,77:1.
        "destructive-solid": "bg-danger text-ink-inverse hover:opacity-90",
      },
      size: {
        // `admin:max-md:h-11`: 44px de área táctil (§9) en el panel; en la
        // tienda `sm` va en chips ya revisados.
        sm: "h-8 rounded-pill px-3 text-body-sm admin:rounded-panel-control admin:max-md:h-11",
        // `max-md:h-11`: 44px de área táctil (§9) en el teléfono.
        md: "h-10 max-md:h-11 rounded-pill px-4 text-body-sm admin:rounded-panel-control",
        lg: "h-12 rounded-pill px-6 text-body admin:h-10 admin:rounded-panel-control admin:text-body-sm",
        // 44px de área táctil (§9), en el panel hasta `lg`: la tablet también
        // se toca con el dedo.
        icon: "size-11 rounded-pill admin:size-9 admin:max-lg:size-11 admin:rounded-panel-control",
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
  title,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, emphasis, className }))}
        title={title}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  // Un botón de solo ícono con `title` lleva tooltip: el `title` nativo no
  // aparece con teclado. El proveedor va adentro porque no todas las
  // pantallas tienen uno arriba.
  if (size === "icon" && typeof title === "string") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              emphasis={emphasis}
              className={className}
              loading={loading}
              loadingLabel={loadingLabel}
              disabled={disabled}
              {...props}
            >
              {children}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{title}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
        className={cn("inline-flex items-center gap-2", loading && "invisible")}
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
