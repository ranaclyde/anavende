"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** El visor de fotos en grande (DR §6.8), compartido por la ficha y el panel. */

export type FotoDelVisor = {
  /** La versión `detail` (1400px, §9.2): el zoom 1:1 mira este archivo. */
  grande: string;
  /** La versión `thumb` (200px), para la tira de miniaturas. */
  miniatura: string;
  /** Lo que escribió la vendedora, o `null`: el visor completa el resto. */
  alt: string | null;
};

function sinMovimiento(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * De la ficha y del visor (`compacta`). En la ficha se dibuja aunque haya una
 * sola foto (ver `Galeria`).
 */
export function Miniaturas({
  imagenes,
  actual,
  descripcion,
  onElegir,
  compacta,
}: {
  imagenes: readonly FotoDelVisor[];
  actual: number;
  descripcion: string;
  onElegir: (i: number) => void;
  compacta?: boolean;
}) {
  return (
    <ul
      className={cn(
        "shrink-0 flex-col gap-2",
        compacta ? "flex" : "hidden md:flex",
      )}
    >
      {imagenes.map((img, i) => (
        <li key={img.grande}>
          <button
            type="button"
            onClick={() => onElegir(i)}
            aria-current={i === actual ? "true" : undefined}
            className={cn(
              // El borde no es decorativo: una foto de fondo blanco sobre
              // superficie blanca no se ve.
              "relative block overflow-hidden rounded-panel-image",
              "border border-border bg-surface transition-shadow duration-150",
              compacta ? "size-12" : "size-16",
              i === actual
                ? "ring-2 ring-brand ring-offset-2 ring-offset-canvas"
                : "opacity-70 hover:opacity-100",
            )}
          >
            <Image
              src={img.miniatura}
              alt=""
              fill
              sizes={compacta ? "48px" : "64px"}
              className="object-contain"
            />
            <span className="sr-only">
              Ver la foto {i + 1} de {descripcion}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type Medida = { w: number; h: number };

/**
 * Dos niveles: encuadrada y a tamaño real, recorrible con el mouse. La foto
 * está siempre a su tamaño natural y `transform` la encoge o la corre: con la
 * misma estructura en los dos estados, el navegador interpola sin salto y la
 * foto no se ve borrosa al ampliar.
 *
 * Es un `<img>` y no `next/image` (TS, la única excepción): el zoom depende
 * del ancho real del archivo, y el optimizador elige otro.
 */
export function Visor({
  imagenes,
  actual,
  descripcion,
  abierta,
  onAbrir,
  onElegir,
}: {
  imagenes: readonly FotoDelVisor[];
  actual: number;
  descripcion: string;
  abierta: boolean;
  onAbrir: (v: boolean) => void;
  onElegir: (i: number) => void;
}) {
  const [natural, setNatural] = useState<Medida | null>(null);
  const [ventana, setVentana] = useState<Medida>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(false);
  const [corrimiento, setCorrimiento] = useState({ x: 0, y: 0 });
  const [animando, setAnimando] = useState(false);
  const marco = useRef<HTMLDivElement>(null);

  const img = imagenes[Math.min(actual, imagenes.length - 1)] as
    FotoDelVisor | undefined;

  // Se calcula y no se mide: medir obligaría a pintar un cuadro con la foto
  // en el lugar equivocado.
  const hueco = { w: ventana.w * 0.72, h: ventana.h * 0.8 };
  const escala =
    natural && ventana.w
      ? Math.min(hueco.w / natural.w, hueco.h / natural.h, 1)
      : 1;
  const encuadre: Medida | null = natural
    ? { w: Math.round(natural.w * escala), h: Math.round(natural.h * escala) }
    : null;

  // Si ya entra a 1:1 no hay nada que ampliar, y el cursor no debe prometerlo.
  const ampliable = escala < 0.98;

  function medirVentana() {
    setVentana({ w: window.innerWidth, h: window.innerHeight });
  }

  function ubicar(e: React.MouseEvent, nat: Medida, enc: Medida) {
    const caja = marco.current?.getBoundingClientRect();
    if (!caja) return { x: 0, y: 0 };
    const px = Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width));
    const py = Math.min(1, Math.max(0, (e.clientY - caja.top) / caja.height));
    return { x: -(nat.w - enc.w) * px, y: -(nat.h - enc.h) * py };
  }

  function alternarZoom(e: React.MouseEvent) {
    e.stopPropagation();
    if (!ampliable || !natural || !encuadre) return;
    setAnimando(!sinMovimiento());
    if (zoom) {
      setZoom(false);
      setCorrimiento({ x: 0, y: 0 });
      return;
    }
    // Entra centrado donde se hizo clic.
    setCorrimiento(ubicar(e, natural, encuadre));
    setZoom(true);
  }

  function recorrer(e: React.MouseEvent) {
    if (!zoom || !natural || !encuadre) return;
    // Sin transición mientras se recorre: con ella la foto persigue al mouse.
    setAnimando(false);
    setCorrimiento(ubicar(e, natural, encuadre));
  }

  function irA(i: number) {
    if (i < 0 || i > imagenes.length - 1) return;
    // Sin esto, la nueva se encuadraría con la escala de la anterior.
    setNatural(null);
    setZoom(false);
    setCorrimiento({ x: 0, y: 0 });
    onElegir(i);
  }

  // Pasa con un color recién agregado; el JSX lee `img` aunque esté cerrado.
  if (!img) return null;

  return (
    <Dialog
      open={abierta}
      onOpenChange={(v) => {
        onAbrir(v);
        if (v) {
          medirVentana();
        } else {
          setZoom(false);
          setCorrimiento({ x: 0, y: 0 });
          setNatural(null);
        }
      }}
    >
      <DialogContent
        closeLabel="Cerrar la galería"
        // `max-h-none`: el tope de alto del diálogo achicaría la galería.
        className="h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none gap-0 overflow-hidden p-0"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") irA(actual - 1);
          if (e.key === "ArrowRight") irA(actual + 1);
        }}
      >
        <DialogTitle className="sr-only">
          {descripcion} — foto {actual + 1} de {imagenes.length}
        </DialogTitle>

        {/* Clic fuera de un control cierra: el modal ocupa la pantalla y
            si no la única salida sería la cruz. */}
        <div
          onClick={() => onAbrir(false)}
          className="relative flex h-full w-full items-center justify-center"
        >
          {imagenes.length > 1 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-1/2 left-4 -translate-y-1/2"
            >
              <Miniaturas
                compacta
                imagenes={imagenes}
                actual={actual}
                descripcion={descripcion}
                onElegir={irA}
              />
            </div>
          ) : null}

          <div
            ref={marco}
            onClick={alternarZoom}
            onMouseMove={recorrer}
            style={
              encuadre ? { width: encuadre.w, height: encuadre.h } : undefined
            }
            className={cn(
              "relative overflow-hidden rounded-image bg-surface",
              encuadre ? "" : "max-h-[80dvh] max-w-[72vw]",
              zoom
                ? "cursor-zoom-out"
                : ampliable
                  ? "cursor-zoom-in"
                  : "cursor-default",
            )}
          >
            {/* `<img>` a propósito: ver el comentario del componente. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.grande}
              alt={img.alt ?? descripcion}
              onLoad={(e) => {
                setNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                });
                medirVentana();
              }}
              style={
                natural
                  ? {
                      width: natural.w,
                      height: natural.h,
                      transformOrigin: "0 0",
                      transform: zoom
                        ? `translate(${corrimiento.x}px, ${corrimiento.y}px) scale(1)`
                        : `translate(0px, 0px) scale(${escala})`,
                    }
                  : undefined
              }
              className={cn(
                "block max-w-none",
                natural ? "" : "max-h-[80dvh] max-w-[72vw]",
                animando
                  ? "transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  : "",
              )}
            />
          </div>

          {imagenes.length > 1 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-6 bottom-6 flex gap-2"
            >
              <BotonDelVisor
                hacia="anterior"
                disponible={actual > 0}
                onClick={() => irA(actual - 1)}
              />
              <BotonDelVisor
                hacia="siguiente"
                disponible={actual < imagenes.length - 1}
                onClick={() => irA(actual + 1)}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BotonDelVisor({
  hacia,
  disponible,
  onClick,
}: {
  hacia: "anterior" | "siguiente";
  disponible: boolean;
  onClick: () => void;
}) {
  const Icono = hacia === "anterior" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!disponible}
      className={cn(
        "flex size-10 items-center justify-center rounded-pill",
        "border border-border bg-surface text-ink-secondary",
        "transition-colors duration-150 hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      <Icono aria-hidden className="size-5" />
      <span className="sr-only">
        {hacia === "anterior" ? "Foto anterior" : "Foto siguiente"}
      </span>
    </button>
  );
}
