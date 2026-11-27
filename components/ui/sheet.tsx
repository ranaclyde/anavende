"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { DialogOverlay, useFocoQueVuelve } from "@/components/ui/dialog";
import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/**
 * Drawer lateral (DR §6.14.3): un diálogo de Radix con otra caja. Solo
 * scrollea `SheetBody`; encabezado y pie quedan fijos. Un `<form>` que
 * envuelva cuerpo y pie va en `SheetForm`, que lleva el `min-h-0`.
 */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  closeLabel = "Cerrar",
  lado = "derecha",
  overlayClassName,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel?: string;
  /** La izquierda es solo para navegar; un formulario sale por la derecha. */
  lado?: "derecha" | "izquierda";
  /** Para el fondo atenuado: los filtros lo nombran en las View Transitions. */
  overlayClassName?: string;
}) {
  const foco = useFocoQueVuelve({ onOpenAutoFocus, onCloseAutoFocus });
  // El portal saca la caja de `[data-scale]` (`escala.tsx`).
  const escala = useDataScale();

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        data-scale={escala}
        {...foco}
        className={cn(
          // `dvh`: el alto que se ve, también con la barra del navegador del teléfono.
          "fixed inset-y-0 z-50 flex h-dvh w-full flex-col bg-surface text-ink shadow-lg",
          lado === "derecha"
            ? "right-0 sm:max-w-[32rem] sm:border-l sm:border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
            : // No ocupa la pantalla entera: el borde a la vista dice que se cierra tocando afuera.
              "left-0 max-w-[20rem] border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          "data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=open]:ease-out",
          "data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=closed]:ease-in",
          "motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute top-5 right-5 inline-flex size-8 items-center justify-center",
            "rounded-pill text-ink-secondary transition-colors duration-150",
            "hover:bg-surface-sunken hover:text-ink",
          )}
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">{closeLabel}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-b border-border px-6 pt-5 pb-4 pr-14",
        className,
      )}
      {...props}
    />
  );
}

function SheetForm({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      data-slot="sheet-form"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-6", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        // En el teléfono los botones se reparten el ancho: uno chico en una esquina se erra.
        "flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4 max-sm:*:flex-1",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-heading text-ink", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-body-sm text-ink-secondary", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetForm,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
