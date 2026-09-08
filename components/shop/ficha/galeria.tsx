"use client";

import Image from "next/image";
import { useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { VarianteDeFicha } from "@/modules/catalog/products/ficha";

/**
 * La galería de la ficha — F3.5, RF-03, DESIGN-REFERENCE §6.8.
 *
 * Tres decisiones del 2026-09-08 que cambian lo que decía §6.8 y por qué:
 *
 * **Las miniaturas van a la IZQUIERDA y se dibujan SIEMPRE**, aunque la
 * variante tenga una sola foto. Antes se escondían con menos de dos, y como
 * ocupan una columna de la fila, la foto principal se corría de lugar al
 * pasar de un color con tres fotos a uno con una. Ese salto no se lee como
 * «este color tiene menos fotos», se lee como que la página se movió sola.
 * La columna es la que sostiene la foto quieta.
 *
 * **No hay botón de ampliar.** Lo decía un ícono en una esquina, que es
 * pedirle a alguien que descubra un control de 36px para hacer lo que ya
 * intentó: tocar la foto. Ahora la foto entera es el control y lo anuncia el
 * cursor —lupa con más—, que es el gesto que ya existe en cualquier tienda.
 *
 * **La foto llega al borde.** Tenía 16px de relleno blanco adentro de una
 * tarjeta blanca: un marco que no se veía como marco, solo como una foto más
 * chica. Ahora la recorta el radio de la tarjeta, así que las esquinas de la
 * imagen son las de la tarjeta y no un cuadrado adentro de un redondeado.
 */

type Imagenes = VarianteDeFicha["imagenes"];

/**
 * §8 pide que TODO movimiento se apague bajo `prefers-reduced-motion`, y la
 * regla global de `globals.css` no alcanza acá: apaga `scroll-behavior`, que
 * es la propiedad de CSS, y no el `behavior: "smooth"` que se pasa por
 * JavaScript.
 */
export function comoDesplazar(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
}

function sinMovimiento(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Galeria({
  imagenes,
  indice,
  alt,
  color,
  pista,
  onScroll,
  onElegir,
}: {
  imagenes: Imagenes;
  indice: number;
  alt: string;
  color: string | null;
  pista: RefObject<HTMLUListElement | null>;
  onScroll: (i: number) => void;
  onElegir: (i: number) => void;
}) {
  const [ampliada, setAmpliada] = useState(false);
  const actual = Math.min(indice, Math.max(0, imagenes.length - 1));

  if (imagenes.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-card bg-surface shadow-md">
        <p className="text-body-sm text-ink-tertiary">
          Todavía no cargamos las fotos de este producto.
        </p>
      </div>
    );
  }

  // §9: «producto, marca y color». Sin el color, dos galerías del mismo
  // producto se anuncian idénticas.
  const descripcion = color ? `${alt}, ${color.toLowerCase()}` : alt;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:gap-4">
      {/*
        Primera en el DOM y a la izquierda en pantalla: el orden que se ve y
        el orden que recorre el teclado son el mismo. Se podía dejar la foto
        primera y girar la fila con `flex-row-reverse`, y era exactamente el
        desacuerdo entre orden visual y orden de lectura que §9 no permite.
      */}
      <Miniaturas
        imagenes={imagenes}
        actual={actual}
        descripcion={descripcion}
        onElegir={onElegir}
      />

      <div className="relative min-w-0 flex-1">
        <ul
          ref={pista}
          // En el teléfono no hay miniaturas y los puntos son un adorno
          // (`aria-hidden`), así que la pista es la única forma de llegar a la
          // segunda foto. Con `tabIndex` es una región desplazable con nombre.
          tabIndex={0}
          aria-label={`Fotos de ${descripcion}`}
          // `overscroll-x-contain`: sin esto, llegar al final de la tira en un
          // teléfono empieza a arrastrar la página hacia atrás.
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card bg-surface shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== indice) onScroll(i);
          }}
        >
          {imagenes.map((img, i) => (
            <li key={img.grande} className="w-full shrink-0 snap-center">
              {/*
                `contain` y no `cover` (§6.8): los periféricos vienen
                fotografiados sobre fondo blanco, y recortarlos los mutila. El
                aspecto se reserva con CSS para que la página no salte cuando
                llega la foto.
              */}
              <div className="relative aspect-square">
                <Image
                  src={img.grande}
                  alt={img.alt ?? `${descripcion} (${i + 1} de ${imagenes.length})`}
                  fill
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  // La primera es el LCP de esta pantalla: es lo más grande
                  // que hay arriba del pliegue.
                  priority={i === 0}
                  className="object-contain"
                />
              </div>
            </li>
          ))}
        </ul>

        {/*
          Cubre la foto entera y existe solo en escritorio (§6.8): en un
          teléfono la foto ya ocupa el ancho de la pantalla y el navegador
          tiene su propio acercamiento con los dedos.

          Sigue siendo un `<button>` y no un `onClick` sobre la imagen: así
          entra en el recorrido de teclado y dice qué hace. Lo que cambió es
          que ya no dibuja nada — lo anuncia el cursor.
        */}
        <button
          type="button"
          onClick={() => setAmpliada(true)}
          className="absolute inset-0 hidden cursor-zoom-in rounded-card md:block"
        >
          <span className="sr-only">Ver la foto en grande</span>
        </button>

        {imagenes.length > 1 ? (
          <>
            <Flecha
              hacia="anterior"
              disponible={actual > 0}
              onClick={() => onElegir(actual - 1)}
            />
            <Flecha
              hacia="siguiente"
              disponible={actual < imagenes.length - 1}
              onClick={() => onElegir(actual + 1)}
            />
          </>
        ) : null}

        {/*
          Los puntos son del teléfono; en escritorio mandan las miniaturas. La
          FILA se dibuja siempre —aunque haya una sola foto y quede vacía—
          por el mismo motivo que la columna de miniaturas: si apareciera y
          desapareciera al cambiar de color, la página se movería sola.
        */}
        <div
          aria-hidden
          className="flex h-1.5 justify-center gap-1.5 pt-3 md:hidden"
        >
          {imagenes.length > 1
            ? imagenes.map((img, i) => (
                <span
                  key={img.grande}
                  className={cn(
                    "size-1.5 rounded-full transition-colors duration-150",
                    i === actual ? "bg-brand" : "bg-border-strong",
                  )}
                />
              ))
            : null}
        </div>
      </div>

      <Visor
        imagenes={imagenes}
        actual={actual}
        descripcion={descripcion}
        abierta={ampliada}
        onAbrir={setAmpliada}
        onElegir={onElegir}
      />
    </div>
  );
}

/**
 * La columna de miniaturas. Se dibuja aunque haya una sola foto: ver el
 * comentario de arriba sobre el salto de la imagen al cambiar de color.
 */
function Miniaturas({
  imagenes,
  actual,
  descripcion,
  onElegir,
  compacta,
}: {
  imagenes: Imagenes;
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

/**
 * Las flechas de §6.8, sobre los bordes de la foto y solo en escritorio.
 *
 * **Se apagan en las puntas en vez de dar la vuelta.** Con encastre de
 * desplazamiento, saltar de la última a la primera arrastra la pista entera
 * de un lado al otro: se ve como un error, no como «volví al principio».
 */
function Flecha({
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
        "absolute top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center md:flex",
        "rounded-pill bg-surface/92 text-ink-secondary shadow-md",
        "transition-colors duration-150 hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-0",
        hacia === "anterior" ? "left-3" : "right-3",
      )}
    >
      <Icono aria-hidden className="size-5" />
      <span className="sr-only">
        {hacia === "anterior" ? "Foto anterior" : "Foto siguiente"}
      </span>
    </button>
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
function Visor({
  imagenes,
  actual,
  descripcion,
  abierta,
  onAbrir,
  onElegir,
}: {
  imagenes: Imagenes;
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

  const img = imagenes[Math.min(actual, imagenes.length - 1)];

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
        className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none gap-0 overflow-hidden p-0"
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
