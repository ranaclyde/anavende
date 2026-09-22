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
 *
 * ESCALERA DE ÉNFASIS, de más a menos peso:
 *
 *   brand      relleno burdeos  — LA acción de la pantalla, una sola
 *   alterna    relleno pizarra  — la OTRA forma de hacer lo mismo, a la par
 *   secondary  contorno gris    — acciones de apoyo entre pares
 *   tertiary   sin caja         — cancelar, volver, lo que no debe pesar
 *
 * `alterna` no es un escalón más abajo de `brand`: es su PAR. Da 9,05:1
 * contra blanco y el burdeos da 9,07:1, así que los dos pesan lo mismo y la
 * persona elige por lo que dicen, no por cuál se ve más. Es para cuando hay
 * dos caminos igual de válidos —el carrito y el WhatsApp de la ficha—, no
 * para jerarquizar.
 *
 * `tertiary` es el ghost: texto solo en reposo, y al pasar el puntero aparece
 * el plato de `--canvas`. En táctil no hay hover, por eso el texto se ve
 * siempre y el área táctil sigue siendo la del tamaño elegido (§9).
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
        alterna:
          "bg-accent text-ink-inverse hover:bg-accent-hover active:bg-accent-active",
        secondary:
          "border border-border bg-surface text-ink hover:bg-surface-sunken hover:border-border-strong",
        tertiary:
          "bg-transparent text-ink-secondary hover:bg-canvas hover:text-ink active:bg-border",
        destructive:
          "border border-danger bg-transparent text-danger hover:bg-danger-tint",
        // Ghost destructivo — §2.2, §6.3. **Solo el panel.**
        //
        // Es el destructivo de una columna de acciones: el ícono en rojo desde
        // el reposo, sin caja. El contorno de `destructive` no entra ahí —una
        // caja por fila, cuarenta por página, se lee como una columna de
        // alertas— y el terciario gris tampoco servía: dejaba el rojo colgado
        // del hover, y en táctil no hay hover. Ana opera en tablet (RNF-01),
        // así que borrar y editar se veían iguales justo donde más caro sale
        // confundirlos.
        "destructive-ghost":
          "bg-transparent text-danger hover:bg-danger-tint active:bg-danger-tint",
        // `text-ink-inverse`, no `text-white`: el token se invierte con el
        // tema y `text-white` no. En oscuro `--danger` se aclara a #f87171 y
        // el blanco encima da 2,77:1 — por debajo de AA incluso para texto
        // grande. Con el token da 6,65:1. En claro los dos valen #ffffff, así
        // que la tienda no cambia.
        "destructive-solid": "bg-danger text-ink-inverse hover:opacity-90",
      },
      size: {
        // Tienda: píldora. Panel: 8px de radio (§3.5).
        // `admin:max-md:h-11`: en el panel este tamaño es el de «Reponer»,
        // «Limpiar todo» y el «Ver» del tablero, y 32px es la mitad de lo que
        // §9 pide para el dedo. En la tienda se deja como está: ahí `sm` vive
        // en chips y píldoras que ya se revisaron a 390 (F3.8).
        sm: "h-8 rounded-pill px-3 text-body-sm admin:rounded-panel-control admin:max-md:h-11",
        // `max-md:h-11`: los 40px de `h-10` quedan cuatro por debajo del
        // mínimo táctil de §9, y este es el tamaño por defecto —lo usan
        // Guardar, Compartir y «Garantías y devoluciones» de la ficha, y todo
        // lo que venga—. Se arregla en la variante y no en cada llamada, o el
        // próximo botón nace con el mismo problema.
        md: "h-10 max-md:h-11 rounded-pill px-4 text-body-sm admin:rounded-panel-control",
        lg: "h-12 rounded-pill px-6 text-body admin:h-10 admin:rounded-panel-control admin:text-body-sm",
        // Cuadrado para acciones de solo ícono. 44px de área táctil en móvil
        // (§9) — y **también en el panel**, que hasta el 2026-09-22 se quedaba
        // en los 36px de `admin:size-9` a cualquier ancho: son los cuatro
        // iconos de cada fila del listado de productos, 109 en una pantalla,
        // el lugar donde más caro sale errarle al de al lado.
        icon: "size-11 rounded-pill admin:size-9 admin:max-md:size-11 admin:rounded-panel-control",
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
