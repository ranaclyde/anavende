"use client";

import { ArrowUpRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { MarcaDelHero } from "./marca-del-hero";
import { cn } from "@/lib/utils";

/**
 * El hero de la home — RF-01, DR §7.1, TS §10.5. Rehecho el 2026-11-20
 * (F10.7d), después de probar unas quince direcciones en la tienda; la
 * forma salió de Atrium MTL.
 *
 * **Dos mitades.** A la izquierda, la marca, el eslogan grande y lo que pasa
 * la página (el buscador y la aclaración). A la derecha, tres columnas —dos
 * filas debajo del texto en el teléfono— con las seis categorías del día:
 * cada una pone su foto, si tiene, y un bloque de color con su nombre y
 * cuántos productos activos tiene. Las dos llevan a la categoría.
 *
 * **La palabra del eslogan** rota por las seis y después dice «la
 * tecnología», que dura el doble. Mientras nombra una, sus piezas quedan
 * enteras y las demás bajan un paso.
 *
 * **El movimiento** es un bucle propio (`useTiras`): cada tira corre a su
 * paso, se frena con el mouse encima y se arrastra —con el mouse las
 * columnas, con el dedo las filas—, con inercia al soltar. Un arrastre no
 * abre la categoría. Las piezas no se recorren con Tab: son muchas, se
 * mueven y las categorías ya están en los chips de abajo.
 *
 * **El freno (WCAG 2.2.2).** Botón de pausa para las tiras y la palabra.
 * Con `prefers-reduced-motion` no corre nada y el eslogan queda en «la
 * tecnología»; arrastrar sigue andando.
 */

export type CategoriaDelHero = {
  nombre: string;
  href: string;
  /** La foto de la categoría (FA-21), en `-card`, o `null`. */
  imagenUrl: string | null;
  cantidad: number;
};

/** Lo que dura cada palabra: lo justo para leerla y mirar las columnas. */
const PALABRA_MS = 3500;
/** «La tecnología» cierra la vuelta y se queda el doble. */
const TECNOLOGIA_MS = 7000;

/**
 * Los bloques, en colores vivos (2026-11-20, elegidos entre tres pruebas:
 * suaves, vivos y pizarra). Son los 700 de Tailwind, todos con texto blanco
 * en AA, y sin rojos ni rosas: el burdeos es de las acciones (DR §3.1). Van
 * en orden: el color es de la posición del día, no de la categoría.
 */
const VIVOS = [
  "#c2410c",
  "#1d4ed8",
  "#15803d",
  "#7e22ce",
  "#b45309",
  "#0f766e",
  "#0369a1",
];

/** Las tiras: la del medio va al revés, cada una a su paso (px por segundo). */
const TIRAS = [
  { sentido: 1, velocidad: 26 },
  { sentido: -1, velocidad: 32 },
  { sentido: 1, velocidad: 22 },
] as const;

/** Por debajo de esto, una tira se queda corta y dejaría un hueco. */
const MINIMO_POR_TIRA = 8;

/**
 * «los teclados», «las sillas». Solo la primera letra va en minúscula, para
 * no romper siglas: «los hubs USB». Si el catálogo trae una categoría
 * femenina que no termina en -as, el artículo tiene que pasar a ser un dato
 * de la categoría (DR §7.1).
 */
function conArticulo(categoria: string): string {
  const palabra =
    categoria.charAt(0).toLocaleLowerCase("es-AR") + categoria.slice(1);
  return `${/as$/i.test(palabra) ? "las" : "los"} ${palabra}`;
}

function productos(n: number) {
  return `${n} ${n === 1 ? "producto" : "productos"}`;
}

type Pieza = { categoria: number; foto: string | null };

/**
 * Cada categoría pone su foto (si tiene) y su bloque. Cada tira arranca en
 * otro tercio de la lista, para que la misma categoría no quede a la misma
 * altura en dos tiras, y la lista se repite hasta llenar.
 */
function armarTiras(categorias: CategoriaDelHero[]): Pieza[][] {
  const lista: Pieza[] = categorias.flatMap((c, i) =>
    c.imagenUrl
      ? [
          { categoria: i, foto: c.imagenUrl },
          { categoria: i, foto: null },
        ]
      : [{ categoria: i, foto: null }],
  );
  if (lista.length === 0) return [];
  return TIRAS.map((_, t) => {
    const corrida = Math.round((t * lista.length) / TIRAS.length);
    const largo =
      Math.ceil(Math.max(MINIMO_POR_TIRA, lista.length) / lista.length) *
      lista.length;
    return Array.from(
      { length: largo },
      (_, k) => lista[(corrida + k) % lista.length],
    );
  });
}

/**
 * El bucle de las tiras. Mueve cada `[data-cinta]` dentro de su
 * `[data-tira]` con `transform`, sin pasar por React: la cinta tiene dos
 * copias iguales, y el corrimiento da la vuelta al largo de una.
 */
function useTiras(
  zona: React.RefObject<HTMLDivElement | null>,
  corre: boolean,
) {
  const corriendo = useRef(corre);
  useEffect(() => {
    corriendo.current = corre;
  }, [corre]);

  useEffect(() => {
    const raiz = zona.current;
    if (!raiz) return;
    const vertical = window.matchMedia("(min-width: 1024px)");
    const tiras = [...raiz.querySelectorAll<HTMLElement>("[data-tira]")].map(
      (tira, i) => ({
        tira,
        cinta: tira.querySelector<HTMLElement>("[data-cinta]")!,
        copia: tira.querySelector<HTMLElement>("[data-copia]")!,
        paso: TIRAS[i].sentido * TIRAS[i].velocidad,
        corrido: 0,
        velocidad: 0,
        encima: false,
      }),
    );
    const arrastre = {
      tira: null as (typeof tiras)[number] | null,
      donde: 0,
      cuando: 0,
      movido: 0,
    };
    let visible = true;
    let antes = performance.now();
    let cuadro = 0;

    const largo = (t: (typeof tiras)[number]) =>
      vertical.matches ? t.copia.offsetHeight : t.copia.offsetWidth;
    const posicion = (e: PointerEvent) =>
      vertical.matches ? e.clientY : e.clientX;

    const pintar = () => {
      for (const t of tiras) {
        const l = largo(t);
        if (!l) continue;
        t.corrido = ((t.corrido % l) + l) % l;
        t.cinta.style.transform = vertical.matches
          ? `translate3d(0, ${(-t.corrido).toFixed(1)}px, 0)`
          : `translate3d(${(-t.corrido).toFixed(1)}px, 0, 0)`;
      }
    };

    const avanzar = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000);
      antes = ahora;
      for (const t of tiras) {
        if (arrastre.tira === t) continue;
        const meta = corriendo.current && !t.encima ? t.paso : 0;
        t.velocidad += (meta - t.velocidad) * Math.min(1, dt * 2.2);
        t.corrido += t.velocidad * dt;
      }
      if (visible) pintar();
      cuadro = requestAnimationFrame(avanzar);
    };

    const baja = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // En la computadora las columnas son verticales: con el dedo, ese
      // gesto es bajar la página, y se lo dejamos al navegador.
      if (vertical.matches && e.pointerType === "touch") return;
      const t = tiras.find((x) => x.tira.contains(e.target as Node));
      if (!t) return;
      arrastre.tira = t;
      arrastre.donde = posicion(e);
      arrastre.cuando = performance.now();
      arrastre.movido = 0;
      t.velocidad = 0;
    };
    const mueve = (e: PointerEvent) => {
      const t = arrastre.tira;
      if (!t) return;
      const d = posicion(e) - arrastre.donde;
      const ahora = performance.now();
      const dt = Math.max(1, ahora - arrastre.cuando) / 1000;
      t.corrido -= d;
      t.velocidad = t.velocidad * 0.6 + (-d / dt) * 0.4;
      arrastre.movido += Math.abs(d);
      arrastre.donde = posicion(e);
      arrastre.cuando = ahora;
    };
    const suelta = () => {
      const t = arrastre.tira;
      if (!t) return;
      arrastre.tira = null;
      // Si se quedó quieto antes de soltar, no hay envión.
      if (performance.now() - arrastre.cuando > 80) t.velocidad = 0;
      t.velocidad = Math.max(-2400, Math.min(2400, t.velocidad));
    };
    // Un arrastre no es un clic: soltar después de arrastrar no abre nada.
    const clic = (e: MouseEvent) => {
      if (arrastre.movido > 6) {
        e.preventDefault();
        e.stopPropagation();
        arrastre.movido = 0;
      }
    };
    const encima = (t: (typeof tiras)[number], valor: boolean) => () => {
      t.encima = valor;
    };
    const conMouse = window.matchMedia("(pointer: fine)").matches;
    const oyentes = tiras.map((t) => ({
      t,
      entra: encima(t, true),
      sale: encima(t, false),
    }));
    if (conMouse)
      for (const { t, entra, sale } of oyentes) {
        t.tira.addEventListener("mouseenter", entra);
        t.tira.addEventListener("mouseleave", sale);
      }
    // Al cambiar de columnas a filas el largo es otro: se arranca de cero.
    const cambio = () => {
      for (const t of tiras) {
        t.corrido = 0;
        t.cinta.style.transform = "";
      }
    };

    const observador = new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting;
    });
    observador.observe(raiz);
    raiz.addEventListener("pointerdown", baja);
    window.addEventListener("pointermove", mueve);
    window.addEventListener("pointerup", suelta);
    window.addEventListener("pointercancel", suelta);
    raiz.addEventListener("click", clic, true);
    vertical.addEventListener("change", cambio);
    cuadro = requestAnimationFrame(avanzar);

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      raiz.removeEventListener("pointerdown", baja);
      window.removeEventListener("pointermove", mueve);
      window.removeEventListener("pointerup", suelta);
      window.removeEventListener("pointercancel", suelta);
      raiz.removeEventListener("click", clic, true);
      vertical.removeEventListener("change", cambio);
      for (const { t, entra, sale } of oyentes) {
        t.tira.removeEventListener("mouseenter", entra);
        t.tira.removeEventListener("mouseleave", sale);
      }
    };
  }, [zona]);
}

export function HeroDeLaHome({
  categorias,
  children,
}: {
  /** Las del día, ya sorteadas (TS §10.5). */
  categorias: CategoriaDelHero[];
  /** El buscador y la aclaración: los arma la página. */
  children: ReactNode;
}) {
  /** De 0 a `categorias.length`; el último es «la tecnología». */
  const [indice, setIndice] = useState(0);
  const [quieto, setQuieto] = useState(false);
  /** Lo pidió la persona, con el botón. */
  const [detenido, setDetenido] = useState(false);
  /** Fuera de la pantalla no tiene sentido seguir cambiando la palabra. */
  const [aLaVista, setALaVista] = useState(true);
  const raiz = useRef<HTMLElement>(null);
  const zona = useRef<HTMLDivElement>(null);

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
    const nodo = raiz.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(([entrada]) =>
      setALaVista(entrada.isIntersecting),
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const total = categorias.length;
  useEffect(() => {
    if (quieto || detenido || !aLaVista || total === 0) return;
    const reloj = setTimeout(
      () => setIndice((n) => (n + 1) % (total + 1)),
      indice >= total ? TECNOLOGIA_MS : PALABRA_MS,
    );
    return () => clearTimeout(reloj);
  }, [quieto, detenido, aLaVista, total, indice]);

  const rota = !quieto && total > 0;
  /** La categoría que nombra la palabra, o -1 con «la tecnología». */
  const actual = rota && indice < total ? indice : -1;
  const palabra =
    actual >= 0 ? conArticulo(categorias[actual].nombre) : "la tecnología";

  const tiras = armarTiras(categorias);
  useTiras(zona, !quieto && !detenido);

  return (
    <section
      ref={raiz}
      aria-label="Presentación"
      className="relative w-full overflow-hidden bg-canvas"
    >
      <div
        className={cn(
          // Columnas y filas con mínimo 0: si no, la grilla toma el largo
          // de las tiras, que son miles de píxeles.
          "mx-auto grid max-w-shop grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-8 sm:px-6 lg:px-8",
          tiras.length > 0
            ? "lg:h-[628px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-14 lg:py-8"
            : "lg:py-16",
        )}
      >
        <div className="relative z-10 flex flex-col items-start gap-6 lg:justify-center lg:pb-10">
          {/*
            La marca, en burdeos y escrita como se escribe: «AnaVende». En la
            primera carga sale del isotipo (`MarcaDelHero`, F10.7c); el nombre
            lo lee el lector de pantalla del `sr-only`.
          */}
          <h1 className="flex flex-col items-start gap-5">
            <MarcaDelHero />
            <span className="sr-only">AnaVende</span>
            {/* El lector de pantalla oye la forma canónica una vez, y no una
                categoría nueva cada pocos segundos. */}
            <span className="sr-only">: vos elegís la tecnología.</span>
            <span aria-hidden className="text-hero text-balance text-ink">
              Vos elegís
              <br />
              <span
                key={palabra}
                className={cn(
                  "inline-block",
                  rota && "motion-safe:animate-palabra",
                )}
              >
                {palabra}.
              </span>
            </span>
          </h1>
          {children}
        </div>

        {tiras.length > 0 ? (
          <div className="relative -mx-4 pb-8 sm:-mx-6 lg:mx-0 lg:h-full lg:pb-0">
            <div
              ref={zona}
              // Decorativas para el lector de pantalla y fuera del Tab: las
              // categorías están en los chips. Con el mouse, cada pieza lleva
              // a la suya. El botón de pausa va afuera de esta caja: adentro
              // de un `aria-hidden` no se podría usar.
              aria-hidden
              className="relative flex flex-col gap-2.5 select-none sm:gap-3 lg:grid lg:h-full lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)] lg:[mask-image:linear-gradient(180deg,transparent,#000_7%,#000_90%,transparent)]"
            >
              {tiras.map((piezas, t) => (
                <div
                  key={t}
                  data-tira
                  className={cn(
                    "relative min-w-0 cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing lg:touch-auto",
                    // En el teléfono, dos filas.
                    t === 2 && "max-lg:hidden",
                  )}
                >
                  <div data-cinta className="flex w-max lg:w-full lg:flex-col">
                    {/* Dos veces la misma tira: al dar la vuelta, empalma. */}
                    {[0, 1].map((copia) => (
                      <div
                        key={copia}
                        data-copia
                        className="flex shrink-0 pl-4 sm:pl-6 lg:flex-col lg:pl-0"
                      >
                        {piezas.map((pieza, i) => {
                          const c = categorias[pieza.categoria];
                          // La que nombra la palabra se destaca y las demás
                          // quedan como están: el bloque se invierte (tinta y
                          // texto blanco) y la foto lleva un borde en tinta.
                          // Apagar las otras dejaba todo gris.
                          const destacada = pieza.categoria === actual;
                          return (
                            <Link
                              key={i}
                              href={c.href}
                              tabIndex={-1}
                              draggable={false}
                              className="group block w-32 shrink-0 pr-2.5 sm:w-36 sm:pr-3 lg:w-full lg:pr-0 lg:pb-3"
                            >
                              {pieza.foto ? (
                                <span className="relative block aspect-[3/4] overflow-hidden rounded-[18px] bg-surface-sunken">
                                  <Image
                                    src={pieza.foto}
                                    alt=""
                                    fill
                                    draggable={false}
                                    // Arriba del pliegue: las primeras, sin
                                    // diferir.
                                    loading={
                                      copia === 0 && i < 3 ? "eager" : "lazy"
                                    }
                                    sizes="(min-width: 1024px) 220px, 144px"
                                    className="pointer-events-none object-cover"
                                  />
                                  {/* El borde va adentro: afuera lo cortaría
                                    el costado de la columna. */}
                                  <span
                                    className={cn(
                                      // Tinta afuera y una línea blanca adentro: sobre una foto
                                      // oscura, la tinta sola no se ve.
                                      "absolute inset-0 rounded-[18px] shadow-[inset_0_0_0_3px_var(--color-ink),inset_0_0_0_5px_rgb(255_255_255/0.9)] transition-opacity duration-500",
                                      destacada ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                </span>
                              ) : (
                                <span
                                  className="relative flex aspect-[3/4] flex-col justify-end gap-0.5 rounded-[18px] p-3 text-white transition-colors duration-500 sm:p-4"
                                  style={{
                                    backgroundColor: destacada
                                      ? "var(--color-ink)"
                                      : VIVOS[pieza.categoria % VIVOS.length],
                                  }}
                                >
                                  {/* Que se note que se toca. */}
                                  <span className="absolute top-3 right-3 grid size-8 place-items-center rounded-pill bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:top-4 sm:right-4">
                                    <ArrowUpRight
                                      aria-hidden
                                      className="size-4"
                                    />
                                  </span>
                                  <span className="text-body-sm font-semibold sm:text-body">
                                    {c.nombre}
                                  </span>
                                  <span className="text-caption">
                                    {productos(c.cantidad)}
                                  </span>
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {rota ? (
              <button
                type="button"
                onClick={() => setDetenido((v) => !v)}
                // El rótulo va dos veces: en `sr-only` para el lector de pantalla y
                // en `title` para el globo del navegador.
                title={
                  detenido ? "Reanudar el movimiento" : "Pausar el movimiento"
                }
                // Abajo a la derecha de las tiras, encima de la última pieza.
                className="absolute right-4 bottom-10 z-30 grid size-11 lg:right-3 lg:bottom-3 place-items-center rounded-pill bg-surface/95 text-ink-secondary shadow-md transition-colors duration-150 hover:text-ink"
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
          </div>
        ) : null}
      </div>
    </section>
  );
}
