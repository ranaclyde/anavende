"use client";

import Image from "next/image";
import { useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { llegadaDeLaFoto } from "@/components/shop/foto-viajera";
import { Miniaturas, Visor } from "@/components/ui/visor-de-fotos";
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

export function Galeria({
  imagenes,
  indice,
  alt,
  color,
  pista,
  onScroll,
  onElegir,
  transicion,
}: {
  imagenes: Imagenes;
  indice: number;
  alt: string;
  color: string | null;
  pista: RefObject<HTMLUListElement | null>;
  onScroll: (i: number) => void;
  onElegir: (i: number) => void;
  /**
   * El slug del producto, para recibir la foto que viene volando desde la
   * tarjeta (`foto-viajera.tsx`). La recibe solo la primera, que es la que se
   * ve al llegar.
   */
  transicion: string;
}) {
  const [ampliada, setAmpliada] = useState(false);
  const actual = Math.min(indice, Math.max(0, imagenes.length - 1));

  if (imagenes.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-card bg-surface shadow-md">
        <p className="text-body-sm text-ink-secondary">
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
          {imagenes.map((img, i) => {
            /*
              `contain` y no `cover` (§6.8): los periféricos vienen
              fotografiados sobre fondo blanco, y recortarlos los mutila. El
              aspecto se reserva con CSS para que la página no salte cuando
              llega la foto.
            */
            // El radio también acá, aunque la pista ya lo recorta: la foto
            // que viaja se dibuja sola, sin la pista alrededor.
            const foto = (
              <div className="relative aspect-square overflow-hidden rounded-card">
                <Image
                  src={img.grande}
                  alt={
                    img.alt ?? `${descripcion} (${i + 1} de ${imagenes.length})`
                  }
                  fill
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  // La primera es el LCP de esta pantalla: es lo más grande
                  // que hay arriba del pliegue, en cualquier ancho. Es la
                  // única imagen de la tienda que pide prioridad alta (TS
                  // §20). `fetchPriority` y no `preload` (F10.4): React ya
                  // precarga toda imagen no diferida, y con esto copia la
                  // prioridad alta a esa precarga, que es lo que la adelanta.
                  loading={i === 0 ? "eager" : undefined}
                  fetchPriority={i === 0 ? "high" : undefined}
                  className="object-contain"
                />
              </div>
            );
            return (
              <li key={img.grande} className="w-full shrink-0 snap-center">
                {i === 0 ? (
                  <div {...llegadaDeLaFoto(transicion)}>{foto}</div>
                ) : (
                  foto
                )}
              </li>
            );
          })}
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
