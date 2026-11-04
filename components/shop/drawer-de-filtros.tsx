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
 * El drawer de los filtros del catálogo — §7.2, decisión del 2026-11-03.
 *
 * **Es el mismo `Sheet` de los drawers del panel** (2026-11-04, pedido tuyo).
 * La primera versión era el `<details>` nativo de antes estirado a drawer, y
 * se sentía peor: aparecía y se iba de golpe —un `<details>` no se anima al
 * abrir ni al cerrar— y había que reimplementar a mano lo que el diálogo de
 * Radix ya trae: el fondo, el foco atrapado, la página quieta, Escape y la
 * vuelta del foco. **Lo que se perdió** es que el panel abriera sin
 * JavaScript; los filtros de adentro siguen siendo enlaces con todo en la
 * dirección (§10.2), así que el atrás y el enlace compartido no cambian.
 *
 * Mide 420px y no los 512 del panel: lo de adentro son chips, y más ancho los
 * deja en renglones largos que se leen peor. En el teléfono, como todo
 * `Sheet`, ocupa la pantalla entera.
 *
 * **Se queda abierto al filtrar.** Cada chip navega sin recargar y el drawer
 * no se desmonta, porque está en el mismo lugar del árbol: se elige una
 * categoría, después una marca, y se cierra con «Ver N productos».
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
          // Con filtros puestos el botón se tiñe. Antes solo cambiaba el
          // circulito del contador, y en una barra de tres controles blancos
          // ese punto pasa desapercibido: la persona no ve que la lista que
          // está mirando está recortada.
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
        className="[view-transition-name:panel-filtros] sm:max-w-[26.25rem]"
        overlayClassName="[view-transition-name:fondo-filtros]"
        // El título alcanza: no hay una bajada que anunciar.
        aria-describedby={undefined}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Filtros
            <Contador puestos={puestos} />
          </SheetTitle>
        </SheetHeader>

        {/*
          Lo ÚNICO que scrollea. `overscroll-contain`: sin él, llegar al final
          de la lista sigue arrastrando la página de atrás.
        */}
        <SheetBody className="flex flex-col gap-7 overscroll-contain">
          {children}
        </SheetBody>

        {/*
          El pie que cierra el trato (§7.2), fijo abajo. No es `SheetFooter`:
          ese reparte el ancho entre los dos botones en el teléfono, y acá
          «Limpiar» es un enlace chico y la acción principal es una sola. El
          área segura, porque en un iPhone sin marco la franja del indicador
          se come el botón.
        */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 border-t border-border",
            "px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
          )}
        >
          {/*
            «Limpiar» solo si hay algo que limpiar, pero el hueco se conserva
            con el `justify-between`: sin esto «Ver productos» salta de la
            derecha al centro según haya filtros o no. Cierra el drawer
            además de navegar: dejarlo abierto con todo desmarcado se lee como
            «no pasó nada».
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

          {/*
            «Ver N productos» solo cierra: cada chip ya navegó al tocarse, así
            que la grilla de atrás ya es la filtrada. `max-sm:flex-1`: en el
            teléfono un botón principal arrinconado con media franja vacía al
            lado se lee como secundario.
          */}
          <SheetClose className="inline-flex h-11 cursor-pointer items-center justify-center rounded-pill bg-brand px-6 text-body-sm font-medium text-ink-inverse transition-colors duration-150 hover:bg-brand-hover focus-visible:shadow-focus focus-visible:outline-none active:bg-brand-active max-sm:flex-1">
            {total === 1 ? "Ver 1 producto" : `Ver ${total} productos`}
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * El número de filtros puestos. Un «2» suelto no dice nada leído en voz
 * alta: queda oculto al lector, y el texto de al lado dice qué son.
 */
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
