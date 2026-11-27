"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/** El único lugar donde el botón destructivo va relleno (DR §2.2). */
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
 * Al cerrarse, el foco vuelve a lo que lo tenía al abrirse. Radix lo devuelve
 * a su `DialogTrigger`, que acá nadie usa, y caía en `<body>`. Un
 * `preventDefault` de quien llama se respeta.
 *
 * Con un campo con `autoFocus` adentro, Radix no dispara `onOpenAutoFocus`:
 * para ese caso, un `focusin` global anota lo último enfocado fuera de las
 * capas.
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
      if (!destino) return;
      const reemplazo = reemplazoDe(destino);
      if (destino.isConnected) destino.focus();
      else enfocarReemplazo(reemplazo);
      if (destino.isConnected) vigilarQueNoSeCaiga(destino, reemplazo);
    },
  };
}

/**
 * Si lo que tenía el foco desaparece —el «Borrar» de una fila borrada—, el
 * foco va a la fila siguiente, la anterior o el título. El reemplazo se anota
 * al cerrar, mientras la fila sigue en pantalla; las hermanas sobreviven al
 * refresco porque React las reconcilia por `key`.
 */
const FILA = "li, tr";
const ENFOCABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function reemplazoDe(destino: HTMLElement): () => HTMLElement | null {
  const fila = destino.closest<HTMLElement>(FILA);
  const vecinas = fila
    ? [fila.nextElementSibling, fila.previousElementSibling]
    : [];
  return () => {
    for (const vecina of vecinas) {
      if (!(vecina instanceof HTMLElement) || !vecina.isConnected) continue;
      const enfocable = vecina.matches(ENFOCABLE)
        ? vecina
        : vecina.querySelector<HTMLElement>(ENFOCABLE);
      if (enfocable) return enfocable;
    }
    const titulo = document.querySelector<HTMLElement>("main h1");
    if (titulo && !titulo.hasAttribute("tabindex")) {
      titulo.setAttribute("tabindex", "-1");
    }
    return titulo;
  };
}

function enfocarReemplazo(reemplazo: () => HTMLElement | null) {
  reemplazo()?.focus();
}

/** Cuánto se espera a que la lista se refresque después de cerrar. */
const VIGILANCIA_MS = 15_000;

function vigilarQueNoSeCaiga(
  destino: HTMLElement,
  reemplazo: () => HTMLElement | null,
) {
  const terminar = () => {
    observador.disconnect();
    clearTimeout(reloj);
    document.removeEventListener("focusin", alMoverse);
  };
  // Si quien usa la pantalla ya fue a otro lado, no se le mueve el foco.
  const alMoverse = (e: FocusEvent) => {
    if (e.target !== destino) terminar();
  };
  const observador = new MutationObserver(() => {
    if (destino.isConnected) return;
    terminar();
    const activo = document.activeElement;
    if (!activo || activo === document.body) enfocarReemplazo(reemplazo);
  });
  observador.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("focusin", alMoverse);
  const reloj = setTimeout(terminar, VIGILANCIA_MS);
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

  // El portal lo saca de `[data-scale]` (`escala.tsx`).
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
          // Sin tope, un diálogo más alto que la pantalla se corta y no se
          // llega a lo de afuera. `svh` y no `vh`: la barra del navegador del
          // teléfono se come parte de `vh`.
          "max-h-[85svh] flex-col gap-4 rounded-modal bg-surface p-6 text-ink shadow-lg",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "duration-200",
          "admin:rounded-panel-image admin:p-5",
          className,
        )}
        {...props}
      >
        {/* Scrollea el contenido y no la caja, para que la × no se vaya con
            él. `min-h-0` para que el tope muerda; `flex-1` y `gap-[inherit]`
            para respetar el alto y la separación que fija quien lo usa. */}
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
