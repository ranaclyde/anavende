"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { DialogOverlay } from "@/components/ui/dialog";
import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/**
 * Drawer lateral — DESIGN-REFERENCE §6.14.3.
 *
 * Es un diálogo de Radix con otra caja: foco atrapado, Escape, bloqueo del
 * scroll del cuerpo y el título anunciado vienen del mismo primitivo, así que
 * no hay nada de accesibilidad que reimplementar.
 *
 * **Sale por la derecha.** La izquierda del panel es la navegación —el menú
 * de 240px, que en el teléfono ya se abre como drawer desde ese lado—, y un
 * formulario que sale de ahí se confunde con el menú. A la derecha deja a la
 * vista la columna de nombres del listado, que es lo que dice qué se está
 * editando.
 *
 * Se arma en tres partes para que lo único que scrollee sea el medio:
 * `SheetHeader` y `SheetFooter` quedan fijos —el título y «Guardar» siempre a
 * la vista—, y `SheetBody` se lleva el resto. Un `<form>` que envuelva cuerpo
 * y pie usa `SheetForm`, que es la misma columna con el `min-h-0` puesto.
 */
const Sheet = DialogPrimitive.Root;

function SheetContent({
  className,
  children,
  closeLabel = "Cerrar",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel?: string;
}) {
  // La misma razón que en `DialogContent`: el portal saca la caja de
  // `[data-scale]` y sin esto se pinta con la escala de la tienda.
  const escala = useDataScale();

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        data-scale={escala}
        className={cn(
          // `dvh`: el alto entero que se ve, también con la barra del
          // navegador del teléfono a la vista. 32rem alcanzan para que un
          // renglón de categoría relacionada entre en una línea.
          "fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col bg-surface text-ink shadow-lg sm:max-w-[32rem] sm:border-l sm:border-border",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-200 data-[state=open]:ease-out",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-150 data-[state=closed]:ease-in",
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

/** La columna que envuelve cuerpo y pie cuando los dos son un `<form>`. */
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
        // En el teléfono los dos botones se reparten el ancho: uno de 80px
        // en una esquina de una pantalla de 390 es fácil de errar.
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
  SheetContent,
  SheetHeader,
  SheetForm,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
