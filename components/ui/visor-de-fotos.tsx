"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * El visor de fotos en grande (§6.8) y su tira de miniaturas.
 *
 * Nació en la galería de la ficha (`components/shop/ficha/galeria.tsx`) y se
 * sacó acá el 2026-11-05 para que el panel amplíe las fotos de un color con
 * el MISMO visor, en vez de un segundo que se comporte distinto.
 */

/**
 * Lo único que el visor necesita de una foto. La ficha le pasa sus imágenes
 * tal cual (`ImagenDeFicha` tiene esto y más); el panel arma estas tres.
 */
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
 * La columna de miniaturas, de la galería de la ficha y del visor
 * (`compacta`). En la ficha se dibuja aunque haya una sola foto: ver el
 * comentario de `Galeria` sobre el salto de la imagen al cambiar de color.
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
              // El borde no es decorativo: los periféricos vienen
              // fotografiados sobre blanco, y una miniatura blanca sobre una
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

// ── Visor ampliado (§6.8) ───────────────────────────────────────────────

type Medida = { w: number; h: number };

/**
 * La foto en grande, con su propia tira de miniaturas y sus flechas.
 *
 * **Dos niveles y no uno.** El primero muestra la foto entera, encuadrada en
 * la pantalla; el segundo la muestra a su TAMAÑO REAL de píxeles y se recorre
 * moviendo el mouse. Eso es lo que hace falta para mirar de cerca la textura
 * de una tecla o lo que dice una etiqueta: encuadrar la foto en la pantalla
 * es, casi siempre, achicarla.
 *
 * **La transición es una sola transformación, no dos imágenes.** La foto está
 * SIEMPRE puesta a su tamaño natural y es `transform` quien la encoge para
 * encuadrarla —`scale(k)`— o la deja en 1:1 y la corre —`translate(x,y)`—.
 * Como las dos formas tienen la misma estructura, el navegador interpola
 * entre ellas y el paso de una a otra es continuo. Cambiar `width` en vez de
 * `transform` habría dado el salto que estamos tratando de sacar, y escalar
 * una imagen ya encuadrada la habría dejado borrosa justo cuando se la quiere
 * mirar de cerca.
 *
 * **Es un `<img>` y no `next/image`**, que es la única excepción del
 * proyecto. El optimizador de Next devuelve el ancho que él elige, y acá el
 * ancho ES el dato: «tamaño real» significa el archivo `-detail` que generó
 * §9.2, no una recompresión de ancho desconocido. Además, sin ese ancho
 * conocido no habría con qué calcular la escala.
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
    | FotoDelVisor
    | undefined;

  // El encuadre se CALCULA y no se mide: medir el `<img>` obligaría a pintar
  // una vez para leer su tamaño y otra para acomodarlo, y el primer cuadro
  // sería la foto en el lugar equivocado.
  const hueco = { w: ventana.w * 0.72, h: ventana.h * 0.8 };
  const escala =
    natural && ventana.w
      ? Math.min(hueco.w / natural.w, hueco.h / natural.h, 1)
      : 1;
  const encuadre: Medida | null = natural
    ? { w: Math.round(natural.w * escala), h: Math.round(natural.h * escala) }
    : null;

  // Si la foto ya entra a 1:1 no hay nada que ampliar, y el cursor no debe
  // prometerlo. Pasa con las fotos chicas que sube la vendedora desde el
  // teléfono, que es un caso real y no uno de laboratorio.
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
    // Entra centrado en DONDE se hizo clic: quien apuntó a la etiqueta del
    // producto espera ver la etiqueta, no el centro geométrico de la foto.
    setCorrimiento(ubicar(e, natural, encuadre));
    setZoom(true);
  }

  function recorrer(e: React.MouseEvent) {
    if (!zoom || !natural || !encuadre) return;
    // Sin transición mientras se recorre: con ella, la foto persigue al mouse
    // con 200ms de retraso y se siente pegajosa.
    setAnimando(false);
    setCorrimiento(ubicar(e, natural, encuadre));
  }

  function irA(i: number) {
    if (i < 0 || i > imagenes.length - 1) return;
    // La foto nueva tiene su propio tamaño: dejar el anterior puesto la
    // encuadraría con la escala de la anterior.
    setNatural(null);
    setZoom(false);
    setCorrimiento({ x: 0, y: 0 });
    onElegir(i);
  }

  // Sin fotos no hay nada que mostrar. Pasa en el panel —un color recién
  // agregado— y el JSX de abajo lee `img` aunque el diálogo esté cerrado.
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
        // `max-h-none`: la galería fija su alto y el tope de 85svh del
        // diálogo la achicaría. Acá la caja ES la pantalla.
        className="h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none gap-0 overflow-hidden p-0"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") irA(actual - 1);
          if (e.key === "ArrowRight") irA(actual + 1);
        }}
      >
        <DialogTitle className="sr-only">
          {descripcion} — foto {actual + 1} de {imagenes.length}
        </DialogTitle>

        {/*
          Clic en cualquier lugar que no sea un control cierra. Es lo que ya
          hace el fondo oscuro de cualquier modal, y acá el modal ocupa la
          pantalla entera: sin esto, el único camino de salida sería la cruz
          de 32px de la esquina.
        */}
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
            {/*
              `<img>` a propósito, no `next/image` — ver el comentario del
              componente. El ancho real del archivo es el dato que hace
              funcionar el zoom, y el optimizador lo reemplaza por el que
              elige él.
            */}
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
