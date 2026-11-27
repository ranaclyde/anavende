"use client";

import { Check, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * El `sonner` de shadcn, sin `next-themes` y `unstyled`: el aspecto sale de
 * los tokens (DR §6.15). Se monta dentro de `MarcoDeEscala`: no usa portal y
 * así hereda `data-scale`.
 */
/**
 * El glifo va en el tinte y no en blanco fijo: con blanco, sobre el verde del
 * modo oscuro queda en 1,5:1, y §9 pide 3:1.
 */
function Disco({
  tono,
  children,
}: {
  tono: "exito" | "pero";
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={`grid size-5 place-items-center rounded-pill ${
        tono === "exito"
          ? "bg-success text-success-tint"
          : "bg-warning text-warning-tint"
      }`}
    >
      {children}
    </span>
  );
}

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      duration={4000}
      visibleToasts={3}
      expand={false}
      containerAriaLabel="Avisos"
      icons={{
        success: (
          <Disco tono="exito">
            <Check className="size-3.5" strokeWidth={3} />
          </Disco>
        ),
        warning: (
          <Disco tono="pero">
            <TriangleAlert className="size-3" strokeWidth={2.75} />
          </Disco>
        ),
      }}
      // Sin esto los avisos quedan pegados al borde en el teléfono.
      mobileOffset={{ left: 16, right: 16, bottom: 16 }}
      offset={{ right: 24, bottom: 24 }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Cerrar el aviso",
        classNames: {
          toast: [
            "flex w-full items-start gap-3 rounded-panel-card border border-border",
            "bg-surface p-3 text-body-sm text-ink shadow-lg",
          ].join(" "),
          icon: "mt-px flex shrink-0",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "font-medium",
          description: "text-caption text-ink-secondary",
          // Solo lo usa `avisarVersionNueva`. Con `unstyled` no trae aspecto ni
          // anillo de foco: se los pone acá.
          actionButton: [
            "shrink-0 self-center rounded-panel-control bg-brand px-3 py-1.5",
            "text-body-sm font-medium text-ink-inverse transition-colors",
            "hover:bg-brand-hover active:bg-brand-active",
            "outline-none focus-visible:shadow-focus",
          ].join(" "),
        },
      }}
      {...props}
    />
  );
}
