"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/**
 * Diálogo — DESIGN-REFERENCE §12.2.
 * Radio 20px en la tienda, 16px en el panel (§3.5).
 * Es el único lugar donde el botón destructivo va RELLENO (§2.2): acá no
 * hay ningún botón de marca al lado con el cual confundirlo.
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        "duration-150",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  closeLabel = "Cerrar",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel?: string;
}) {
  // El portal lo saca de `[data-scale]`, así que se lo lleva puesto: sin
  // esto, un diálogo del panel se pinta con la escala de la tienda y sus
  // propias clases `admin:` de más abajo no valen nada (ver `escala.tsx`).
  const escala = useDataScale();

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-scale={escala}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          // El tope de alto va acá y no en cada diálogo: hasta el 2026-09-21
          // lo tenía **uno de los veinticinco**, y los otros veinticuatro, si
          // crecían más que la pantalla, se cortaban arriba y abajo sin
          // ninguna forma de llegar a lo que quedaba afuera — ni siquiera
          // scrolleando, porque una caja centrada y fija no scrollea.
          // `svh` y no `vh`: en el teléfono la barra del navegador se come
          // parte de `vh` y el diálogo terminaba debajo de ella.
          "max-h-[85svh] flex-col gap-4 rounded-modal bg-surface p-6 text-ink shadow-lg",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "duration-200",
          "admin:rounded-panel-image admin:p-5",
          className,
        )}
        {...props}
      >
        {/* Lo que scrollea es el contenido y no la caja, para que la × quede
            siempre a la vista: dentro de un contenedor con scroll, un
            `absolute top-4` se va con el contenido y el diálogo se queda sin
            su salida visible.
            `min-h-0` porque un hijo de flex no baja del alto de su contenido
            sin eso, y entonces el tope de arriba no mordería.
            `flex-1` y `gap-[inherit]` para que este envoltorio sea
            transparente: hay diálogos que fijan su alto y su separación desde
            afuera —la galería de la ficha manda `h-[calc(100dvh-2rem)]` y
            `gap-0`— y sin estas dos, meterles una caja en el medio les rompe
            las dos cosas. */}
        <div className="flex min-h-0 flex-1 flex-col gap-[inherit] overflow-y-auto">
          {children}
        </div>
        <DialogPrimitive.Close
          className={cn(
            "absolute top-4 right-4 inline-flex size-8 items-center justify-center",
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

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 pr-8", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-heading text-ink", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-body-sm text-ink-secondary", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
