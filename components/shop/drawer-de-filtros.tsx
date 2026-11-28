"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { EsperaDelFiltro } from "@/components/shop/filtrando";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TIPO_FILTRO } from "@/lib/transiciones";
import { AREA_TACTIL, cn } from "@/lib/utils";

/**
 * El drawer de los filtros del catálogo, el mismo `Sheet` de los del panel.
 * Se queda abierto al filtrar: no se desmonta porque no cambia de lugar en el
 * árbol.
 *
 * Lleva nombre de View Transition, él y su fondo: sin eso las tarjetas que se
 * reacomodan al filtrar le pasan por encima (`globals.css`).
 */
export function DrawerDeFiltros({
  puestos,
  total,
  hrefLimpiar,
  children,
}: {
  puestos: number;
  total: number;
  /** A dónde lleva «Limpiar filtros», o `null` si no hay nada que limpiar. */
  hrefLimpiar: string | null;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          "flex h-12 cursor-pointer items-center gap-2 rounded-pill",
          "border px-5 text-body shadow-sm",
          "transition-colors duration-150",
          "focus-visible:shadow-focus focus-visible:outline-none",
          puestos > 0
            ? "border-brand-tint-border bg-brand-tint font-medium text-brand"
            : "border-border bg-surface text-ink hover:border-border-strong",
        )}
      >
        <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
        Filtros
        <Contador puestos={puestos} />
        <span className="sr-only">
          {puestos === 0
            ? "Ninguno aplicado"
            : puestos === 1
              ? "1 filtro aplicado"
              : `${puestos} filtros aplicados`}
        </span>
      </SheetTrigger>

      <SheetContent
        closeLabel="Cerrar los filtros"
        className="[view-transition-name:panel-filtros] focus:outline-none"
        overlayClassName="[view-transition-name:fondo-filtros]"
        aria-describedby={undefined}
        // El foco va al drawer: Radix saltea los enlaces y caería en el
        // buscador, que en el teléfono abre el teclado.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        {/* `min-h-8`: el alto de la ×, para que queden en la misma línea. */}
        <SheetHeader>
          <SheetTitle className="flex min-h-8 items-center gap-2">
            Filtros
            <Contador puestos={puestos} />
          </SheetTitle>
        </SheetHeader>

        {/* `overscroll-contain`: sin él, al final arrastra la página de atrás. */}
        <SheetBody className="flex flex-col divide-y divide-border overscroll-contain *:py-6 *:first:pt-0 *:last:pb-0">
          {children}
        </SheetBody>

        {/*
          No es `SheetFooter`: ese reparte el ancho entre los dos botones. El
          área segura, porque en un iPhone sin marco el indicador tapa el botón.
        */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 border-t border-border",
            "px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
          )}
        >
          {/*
            Sin nada que limpiar queda el hueco, para que «Ver productos» no
            salte al centro. Cierra además de navegar.
          */}
          {hrefLimpiar ? (
            <SheetClose asChild>
              <Link
                href={hrefLimpiar}
                transitionTypes={TIPO_FILTRO}
                className={cn(
                  "relative shrink-0 rounded-pill px-1 py-1.5 text-body-sm text-ink-secondary underline underline-offset-2",
                  "transition-colors duration-150 hover:text-brand",
                  "focus-visible:shadow-focus focus-visible:outline-none",
                  AREA_TACTIL,
                )}
              >
                Limpiar filtros
                <EsperaDelFiltro />
              </Link>
            </SheetClose>
          ) : (
            <span />
          )}

          {/* Solo cierra: cada chip ya navegó al tocarse. */}
          <SheetClose className="inline-flex h-11 cursor-pointer items-center justify-center rounded-pill bg-brand px-6 text-body-sm font-medium text-ink-inverse transition-colors duration-150 hover:bg-brand-hover focus-visible:shadow-focus focus-visible:outline-none active:bg-brand-active max-sm:flex-1">
            {total === 1 ? "Ver 1 producto" : `Ver ${total} productos`}
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Oculto al lector: un «2» suelto no dice nada; el texto de al lado sí. */
function Contador({ puestos }: { puestos: number }) {
  if (puestos === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-caption font-medium text-ink-inverse tabular-nums"
    >
      {puestos}
    </span>
  );
}
