"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ESCENA_BASE, type PiezaDelHero } from "./escena-del-hero";
import { cn } from "@/lib/utils";

/**
 * El hero de la home — RF-01, §7.1. Rehecho el 2026-10-19 (pedido tuyo).
 *
 * **El nombre y el eslogan al centro, una escena alrededor.** Se lee
 * «AnaVende / vos elegís los auriculares»: el nombre es la primera mitad del
 * eslogan (§2.4), así que no se repite «Ana vende». La palabra final rota por
 * las categorías destacadas —las mismas de los chips de abajo—, que es el
 * contexto que §2.4 pide para rotarla.
 *
 * **La escena es decorativa y no se toca.** Son imágenes del diseño
 * (`escena-del-hero.ts`), no productos: no son enlaces y el lector de
 * pantalla no las oye. Lo que se puede tocar está todo al centro.
 *
 * **Un solo movimiento: la profundidad.** Las piezas no flotan solas; se
 * corren y se inclinan según su profundidad, y eso es lo que las hace leer en
 * 3D:
 *
 * - **Con el mouse**, solo donde hay uno (`pointer: fine`): la escena sigue
 *   al puntero con inercia, en sentido contrario, como lo cercano cuando
 *   movés la cabeza.
 * - **Con el scroll**, en todos lados: al bajar, las capas se separan a
 *   distinta velocidad. Es la profundidad del teléfono, que no tiene mouse y
 *   donde el giroscopio pide un permiso con un cartel.
 *
 * **Nada de esto pasa por React.** El puntero y el scroll escriben tres
 * variables CSS en el escenario (`--px`, `--py`, `--sy`) dentro de un
 * `requestAnimationFrame`, y cada pieza arma su `transform` con ellas
 * (`paralaje` en `globals.css`). Moverse no vuelve a dibujar ningún
 * componente, y el bucle se apaga solo cuando la escena llegó a su lugar.
 *
 * **El freno (WCAG 2.2.2).** La palabra cambia sola cada pocos segundos, y
 * eso es movimiento que arranca solo: el botón de pausa la detiene, y de paso
 * deja la escena quieta. Con `prefers-reduced-motion` no se mueve nada y el
 * eslogan queda en su forma canónica.
 */

/** Lo que dura cada palabra: lo justo para leerla y mirar la escena. */
const VUELTA = 3500;

/**
 * «Auriculares» → «los auriculares». Es una aproximación: «Sillas» da «las»,
 * pero una categoría femenina que no termina en -as («Notebooks»,
 * «Fuentes») saldría con «los». Si el catálogo real trae una, el artículo
 * tiene que ser un dato de la categoría y no una regla.
 */
function conArticulo(categoria: string): string {
  const palabra = categoria.toLocaleLowerCase("es-AR");
  return `${/as$/.test(palabra) ? "las" : "los"} ${palabra}`;
}

/** Más cerca, más sombra y más nítida: es parte de la profundidad. */
const POR_PROFUNDIDAD: Record<PiezaDelHero["d"], string> = {
  1: "drop-shadow-[0_22px_28px_rgb(17_16_16/0.22)]",
  0.65: "drop-shadow-[0_14px_18px_rgb(17_16_16/0.16)]",
  0.35: "opacity-90 blur-[1px] drop-shadow-[0_8px_10px_rgb(17_16_16/0.12)]",
};

export function HeroDeLaHome({
  categorias,
  escena = ESCENA_BASE,
  children,
}: {
  /** Los nombres de las categorías destacadas, para la palabra que rota. */
  categorias: string[];
  escena?: PiezaDelHero[];
  /** La bajada y el buscador: los arma la página. */
  children: ReactNode;
}) {
  const [indice, setIndice] = useState(0);
  const [quieto, setQuieto] = useState(false);
  /** Lo pidió la persona, con el botón. */
  const [detenido, setDetenido] = useState(false);
  /** Fuera de la pantalla no tiene sentido seguir cambiando la palabra. */
  const [aLaVista, setALaVista] = useState(true);
  const escenario = useRef<HTMLDivElement>(null);

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
    const nodo = escenario.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(([entrada]) =>
      setALaVista(entrada.isIntersecting),
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (quieto || detenido || !aLaVista || categorias.length < 2) return;
    const reloj = setInterval(
      () => setIndice((n) => (n + 1) % categorias.length),
      VUELTA,
    );
    return () => clearInterval(reloj);
  }, [quieto, detenido, aLaVista, categorias.length]);

  // El paralaje. Un solo bucle que acerca el valor actual al objetivo un 8%
  // por cuadro: eso es la inercia. Mientras corre, el escenario lleva
  // `data-moviendo`, que es lo que enciende `will-change` (`globals.css`):
  // con la escena quieta no reserva memoria de la placa de video.
  useEffect(() => {
    const nodo = escenario.current;
    if (!nodo) return;
    if (quieto || detenido) {
      for (const v of ["--px", "--py", "--sy"]) nodo.style.setProperty(v, "0");
      return;
    }

    const conMouse = window.matchMedia("(pointer: fine)").matches;
    const objetivo = { x: 0, y: 0, s: 0 };
    const actual = { x: 0, y: 0, s: 0 };
    let cuadro = 0;

    const pintar = () => {
      actual.x += (objetivo.x - actual.x) * 0.08;
      actual.y += (objetivo.y - actual.y) * 0.08;
      actual.s += (objetivo.s - actual.s) * 0.2;
      nodo.style.setProperty("--px", actual.x.toFixed(4));
      nodo.style.setProperty("--py", actual.y.toFixed(4));
      nodo.style.setProperty("--sy", actual.s.toFixed(1));
      const falta =
        Math.abs(objetivo.x - actual.x) +
        Math.abs(objetivo.y - actual.y) +
        Math.abs(objetivo.s - actual.s);
      if (falta > 0.001) {
        cuadro = requestAnimationFrame(pintar);
      } else {
        cuadro = 0;
        delete nodo.dataset.moviendo;
      }
    };
    const arrancar = () => {
      if (cuadro) return;
      nodo.dataset.moviendo = "";
      cuadro = requestAnimationFrame(pintar);
    };

    const alMover = (e: PointerEvent) => {
      const caja = nodo.getBoundingClientRect();
      // De -1 a 1 desde el centro del escenario, recortado: con el puntero
      // lejos del hero, la escena no sigue yéndose.
      const x = ((e.clientX - caja.left) / caja.width) * 2 - 1;
      const y = ((e.clientY - caja.top) / caja.height) * 2 - 1;
      objetivo.x = Math.max(-1, Math.min(1, x));
      objetivo.y = Math.max(-1, Math.min(1, y));
      arrancar();
    };
    const alSalir = () => {
      objetivo.x = 0;
      objetivo.y = 0;
      arrancar();
    };
    const alBajar = () => {
      // Solo mientras el hero se ve: más abajo no hay nada que separar.
      objetivo.s = Math.min(window.scrollY, nodo.offsetHeight);
      arrancar();
    };

    if (conMouse) {
      window.addEventListener("pointermove", alMover, { passive: true });
      document.documentElement.addEventListener("pointerleave", alSalir);
    }
    window.addEventListener("scroll", alBajar, { passive: true });
    alBajar();

    return () => {
      cancelAnimationFrame(cuadro);
      delete nodo.dataset.moviendo;
      window.removeEventListener("pointermove", alMover);
      document.documentElement.removeEventListener("pointerleave", alSalir);
      window.removeEventListener("scroll", alBajar);
    };
  }, [quieto, detenido]);

  const rota = !quieto && categorias.length > 0;
  const palabra = rota
    ? conArticulo(categorias[indice % categorias.length])
    : "la tecnología";

  return (
    <div
      ref={escenario}
      className="relative isolate w-full pt-32 pb-36 sm:pt-40 sm:pb-44 lg:py-32"
    >
      {/* El centro. No se mueve. */}
      <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
        {/*
          La marca, en burdeos y escrita como se escribe: «AnaVende», con las
          dos mayúsculas. Hasta el 2026-10-19 iba en minúsculas (§2.3, desvío
          del 2026-09-22); se volvió a la forma del nombre a pedido tuyo.
        */}
        <h1 className="flex flex-col items-center gap-1">
          <span className="text-display text-brand sm:text-marca">
            AnaVende
          </span>
          {/* El lector de pantalla oye la forma canónica una vez, y no una
              categoría nueva cada pocos segundos. */}
          <span className="sr-only">: vos elegís la tecnología.</span>
          <span
            aria-hidden
            className="text-heading font-normal text-ink-secondary sm:text-title sm:font-normal"
          >
            vos elegís{" "}
            <span
              key={palabra}
              className="inline-block font-semibold text-ink motion-safe:animate-palabra"
            >
              {palabra}
            </span>
            .
          </span>
        </h1>

        {children}
      </div>

      {rota ? (
        <button
          type="button"
          onClick={() => setDetenido((v) => !v)}
          // El rótulo va dos veces: en `sr-only` para el lector de pantalla y
          // en `title` para el globo del navegador.
          title={detenido ? "Reanudar el movimiento" : "Pausar el movimiento"}
          // Hasta `lg`, abajo al medio: es el hueco que dejan las piezas de
          // abajo. Desde `lg`, arriba a la derecha.
          className="absolute bottom-0 left-1/2 z-20 grid size-11 -translate-x-1/2 place-items-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface hover:text-ink lg:top-0 lg:right-0 lg:bottom-auto lg:left-auto lg:translate-x-0"
        >
          {detenido ? (
            <Play aria-hidden className="size-4" />
          ) : (
            <Pause aria-hidden className="size-4" />
          )}
          <span className="sr-only">
            {detenido ? "Reanudar el movimiento" : "Pausar el movimiento"}
          </span>
        </button>
      ) : null}

      {/* La escena. `aria-hidden` entera: es decoración. */}
      <div aria-hidden className="absolute inset-0 [perspective:1100px]">
        {escena.map((pieza) => (
          <div
            key={pieza.src}
            className={cn("absolute", pieza.lugar)}
            style={
              {
                "--d": pieza.d,
                zIndex: Math.round(pieza.d * 10),
              } as React.CSSProperties
            }
          >
            <div className="paralaje">
              <Image
                src={pieza.src}
                alt=""
                width={pieza.ancho}
                height={pieza.alto}
                sizes="(min-width: 1024px) 288px, (min-width: 640px) 208px, 160px"
                // Arriba del pliegue en el primer pintado: sin diferir.
                loading="eager"
                draggable={false}
                className={cn(
                  "h-auto w-full select-none",
                  POR_PROFUNDIDAD[pieza.d],
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
