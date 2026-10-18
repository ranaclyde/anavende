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

type AutoFoco = Pick<
  React.ComponentProps<typeof DialogPrimitive.Content>,
  "onOpenAutoFocus" | "onCloseAutoFocus"
>;

/**
 * **Al cerrarse, el foco vuelve a lo que lo tenía al abrirse** (F10.3).
 *
 * Radix lo devuelve a su `DialogTrigger`, y acá ningún diálogo ni drawer lo
 * usa: se abren con un botón propio y estado, así que el foco caía en
 * `<body>` y quien usa teclado volvía al principio de la página. Si quien lo
 * llama tiene otro manejo —un `preventDefault`—, se respeta.
 *
 * Lo usan `DialogContent` y `SheetContent`.
 *
 * **Con un campo con `autoFocus` adentro, Radix no avisa la apertura**: el
 * campo toma el foco cuando React lo monta, y con el foco ya adentro
 * `onOpenAutoFocus` no se dispara. Para ese caso, un solo `focusin` en el
 * documento anota el último elemento enfocado fuera de un diálogo o un
 * drawer, y se usa ése. Cuando sí avisa, gana lo que tenía el foco en ese
 * momento, que sirve también para un diálogo abierto desde otro.
 */
const CAPA = '[data-slot="dialog-content"], [data-slot="sheet-content"]';
let fueraDeLasCapas: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener("focusin", (e) => {
    if (e.target instanceof HTMLElement && !e.target.closest(CAPA)) {
      fueraDeLasCapas = e.target;
    }
  });
}

export function useFocoQueVuelve({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: AutoFoco): Required<AutoFoco> {
  const previo = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (e) => {
      previo.current = document.activeElement as HTMLElement | null;
      onOpenAutoFocus?.(e);
    },
    onCloseAutoFocus: (e) => {
      onCloseAutoFocus?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      const destino = previo.current ?? fueraDeLasCapas;
      previo.current = null;
      if (destino?.isConnected) destino.focus();
    },
  };
}

function DialogContent({
  className,
  children,
  closeLabel = "Cerrar",
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel?: string;
}) {
  const foco = useFocoQueVuelve({ onOpenAutoFocus, onCloseAutoFocus });

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
        {...foco}
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
