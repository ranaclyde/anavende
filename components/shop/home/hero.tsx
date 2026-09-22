"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { ConjuntoDelHero } from "@/modules/catalog/products/home";
import { cn } from "@/lib/utils";

/**
 * Los bloques flotantes del hero — RF-01, §7.1. Tarea F3.7.
 *
 * **Lo que llena el hero es el catálogo**, y no una foto de banco de imágenes:
 * cinco productos de verdad, con su nombre, antes de que nadie haya leído una
 * línea. Es la respuesta más corta a «¿qué hay acá?».
 *
 * **Una categoría por vez, y la categoría cambia.** Mezclar productos de cinco
 * categorías daría una vitrina linda y muda; de a una, cada vuelta cuenta una
 * parte del catálogo —ahora mouses, al rato teclados—.
 *
 * **Flotan.** Ocho píxeles de recorrido en cinco segundos, cada bloque con su
 * retraso y su duración: en sincronía serían un ascensor de cinco puertas, y
 * desfasados son cosas que flotan. Es el único movimiento continuo de la
 * pantalla junto con la hilera de logos, y la regla global lo apaga entero con
 * `prefers-reduced-motion`.
 *
 * **Se frena mientras lo mirás.** Los bloques son enlaces a la ficha, y un
 * enlace que se va justo cuando lo estás apuntando es peor que no tenerlo: con
 * el mouse encima o el foco del teclado adentro, el reloj se para. Y con
 * `prefers-reduced-motion` no arranca nunca (§8): se queda en la primera
 * categoría, entera y alcanzable.
 *
 * **No se precarga la tanda siguiente.** El bloque más grande mide 152px, la
 * entrada escalonada le da a cada uno entre 300 y 400ms de ventaja, y después
 * de la primera vuelta están todas en la caché del navegador.
 * Precargarlas exigiría un segundo árbol invisible con sus enlaces apagados,
 * que es mucho andamio para el problema que resuelve.
 */

/** §7.1: alcanza para mirar cinco fotos sin que parezca un cartel de ruta. */
const VUELTA = 6000;

/**
 * El arco. Son las posiciones del boceto, de izquierda a derecha: sube, baja,
 * sube más, y el último vuelve al medio. En el teléfono los saltos son la
 * mitad —con 88px de bloque, un desnivel de 44 se lee como un error—.
 */
const ARCO = [
  "translate-y-4 sm:translate-y-7",
  "-translate-y-3 sm:-translate-y-5",
  "translate-y-6 sm:translate-y-11",
  "sm:-translate-y-9",
  "lg:translate-y-3",
];

/**
 * Cuántos bloques entran según el ancho: tres en el teléfono, cuatro desde
 * `sm`, los cinco desde `lg`. A 390px, cinco serían cinco estampillas.
 */
const VISIBILIDAD = ["", "", "", "hidden sm:block", "hidden lg:block"];

export function BloquesDelHero({
  conjuntos,
}: {
  conjuntos: ConjuntoDelHero[];
}) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [quieto, setQuieto] = useState(false);

  // El estado y no una lectura suelta de `matchMedia`: quien cambia la
  // preferencia del sistema con la pestaña abierta espera que el movimiento
  // pare ahí mismo, no en la próxima navegación.
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setQuieto(consulta.matches);
    leer();
    consulta.addEventListener("change", leer);
    return () => consulta.removeEventListener("change", leer);
  }, []);

  useEffect(() => {
    if (quieto || pausado || conjuntos.length < 2) return;
    const reloj = setInterval(
      () => setIndice((n) => (n + 1) % conjuntos.length),
      VUELTA,
    );
    return () => clearInterval(reloj);
  }, [quieto, pausado, conjuntos.length]);

  if (conjuntos.length === 0) return null;

  const actual = conjuntos[indice % conjuntos.length];

  return (
    <div
      role="group"
      aria-label={`Algunos productos de ${actual.categoria}`}
      // `onFocus`/`onBlur` de React son `focusin`/`focusout`: suben desde el
      // enlace de adentro, que es justo lo que hace falta acá.
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="w-full"
    >
      {/*
        La `key` es el índice, y eso es lo que hace la animación de entrada:
        React desmonta la tanda anterior y monta la nueva, así que los bloques
        vuelven a arrancar su `animate-bloque` sin un solo estado más.
      */}
      <ul
        key={indice}
        // El relleno de abajo no es simétrico, y por eso no es `py-`: el arco
        // baja hasta 44px con `translate`, que no ocupa lugar en el layout. Sin
        // esa reserva, el bloque más bajo se le montaba a la palabra de la
        // marca —se veía, y ninguna medida del código lo decía—.
        className="flex items-center justify-center gap-2.5 pt-6 pb-10 sm:gap-4 sm:pt-10 sm:pb-16"
      >
        {actual.productos.map((producto, i) => (
          <li
            key={producto.slug}
            // El desnivel del arco va ACÁ y la animación adentro: las dos son
            // `transform`, y en el mismo elemento la animación se come el
            // desnivel al terminar (`both` deja el estado final puesto).
            className={cn("shrink-0", ARCO[i], VISIBILIDAD[i])}
          >
            <div
              className="animate-bloque"
              // Escalonados: la tanda entra como una tanda y no como un
              // parpadeo. Inline porque es un número por bloque, no una clase.
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/*
                El vaivén va en su propio envoltorio, entre la entrada y el
                enlace: las tres son `transform` y en el mismo elemento se
                pisan —la entrada terminaría clavando el bloque a media altura
                y el `hover` de la tarjeta no levantaría nada—.
              */}
              <div
                className="animate-vaiven"
                // Cada uno con su tiempo: en sincronía serían un ascensor de
                // cinco puertas. Desfasados son cosas que flotan.
                style={{
                  animationDelay: `${i * 700}ms`,
                  animationDuration: `${5 + i * 0.4}s`,
                }}
              >
                <Link
                  href={`/productos/${producto.slug}`}
                  className={cn(
                    "group flex w-22 flex-col rounded-card bg-surface p-2 shadow-md sm:w-28 lg:w-38",
                    "transition-shadow duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    "hover:shadow-lg focus-visible:shadow-focus",
                    "motion-safe:transition-[box-shadow,transform] motion-safe:hover:-translate-y-0.5",
                  )}
                >
                  <div className="relative aspect-square overflow-hidden rounded-image bg-surface-sunken">
                    {/*
                      `alt` vacío a propósito: el nombre del producto está acá
                      abajo, DENTRO del mismo enlace, así que un texto
                      alternativo lo repetiría —«Teclado Kumara K552, Teclado
                      Kumara K552»— cada vez que alguien recorre la página con
                      un lector de pantalla.
                    */}
                    <Image
                      src={producto.src}
                      alt=""
                      fill
                      // Es el ancho de la IMAGEN, no el del bloque: el bloque
                      // tiene 8px de relleno de cada lado, así que 152 son 136
                      // de foto.
                      sizes="(min-width: 1024px) 136px, (min-width: 640px) 96px, 72px"
                      // Sólo la primera tanda, que es la que está arriba del
                      // pliegue en el primer pintado. Las que siguen llegan
                      // cuando ya no hay nada que disputarle al LCP.
                      priority={indice === 0}
                      className="object-cover"
                    />
                  </div>

                  <p className="truncate pt-2 text-caption font-medium text-ink">
                    {producto.nombre}
                  </p>
                  <p className="truncate text-caption text-ink-secondary">
                    {actual.categoria}
                  </p>
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
