"use client";

import { ArrowUpRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { MarcaDelHero } from "./marca-del-hero";
import { cn } from "@/lib/utils";

// El diseño está en DESIGN-REFERENCE §7.1 y el movimiento en TECHNICAL-SPEC §10.5.

export type CategoriaDelHero = {
  nombre: string;
  href: string;
  /** En `-card`. */
  imagenUrl: string | null;
  cantidad: number;
};

const PALABRA_MS = 3500;
const TECNOLOGIA_MS = 7000;

/** Los 700 de Tailwind: texto blanco en AA, y sin rojos ni rosas (DR §3.1). */
const VIVOS = [
  "#c2410c",
  "#1d4ed8",
  "#15803d",
  "#7e22ce",
  "#b45309",
  "#0f766e",
  "#0369a1",
];

/** Velocidad en px por segundo. */
const TIRAS = [
  { sentido: 1, velocidad: 26 },
  { sentido: -1, velocidad: 32 },
  { sentido: 1, velocidad: 22 },
] as const;

/** Por debajo de esto, una tira se queda corta y dejaría un hueco. */
const MINIMO_POR_TIRA = 8;

/**
 * Solo la primera letra va en minúscula, para no romper siglas: «los hubs
 * USB». Una categoría femenina sin -as necesitaría el artículo como dato.
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
 * Cada tira arranca en otro tercio de la lista, para que la misma categoría
 * no quede a la misma altura en dos tiras.
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
 * Mueve cada `[data-cinta]` con `transform`, sin pasar por React. La cinta
 * tiene dos copias iguales, y el corrimiento da la vuelta al largo de una.
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
      // Con el dedo, arrastrar en vertical es bajar la página: es del navegador.
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
    // De columnas a filas el largo es otro: se arranca de cero.
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
  chips,
  children,
}: {
  /** Las del día, ya sorteadas. */
  categorias: CategoriaDelHero[];
  /** Aparte del texto porque en el teléfono van debajo de las fotos. */
  chips?: ReactNode;
  /** El buscador y la aclaración. */
  children: ReactNode;
}) {
  /** De 0 a `categorias.length`; el último es «la tecnología». */
  const [indice, setIndice] = useState(0);
  const [quieto, setQuieto] = useState(false);
  /** Con el botón de pausa. */
  const [detenido, setDetenido] = useState(false);
  const [aLaVista, setALaVista] = useState(true);
  const raiz = useRef<HTMLElement>(null);
  const zona = useRef<HTMLDivElement>(null);

  // Escuchado y no leído una vez: si cambia la preferencia con la pestaña
  // abierta, el movimiento para ahí mismo.
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
  const palabras = [
    ...categorias.map((c) => conArticulo(c.nombre)),
    "la tecnología",
  ];

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
          // Mínimo 0: si no, la grilla toma el largo de las tiras, miles de píxeles.
          "mx-auto grid max-w-shop grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6 lg:px-8",
          tiras.length > 0
            ? "lg:h-[628px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[minmax(0,1fr)_auto_auto_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-6 lg:py-8"
            : "lg:py-16",
        )}
      >
        <div className="relative z-10 flex flex-col items-start gap-6 lg:col-start-1 lg:row-start-2">
          {/* El nombre lo lee el lector de pantalla del `sr-only`. */}
          <h1 className="flex flex-col items-start gap-5">
            <MarcaDelHero />
            <span className="sr-only">AnaVende</span>
            {/* El lector oye la forma canónica una vez, no cada rotación. */}
            <span className="sr-only">: vos elegís la tecnología.</span>
            <span aria-hidden className="block text-hero text-ink">
              <span className="block">Vos elegís</span>
              {/*
                Todas apiladas e invisibles en la misma celda: el título mide
                lo de la más larga y lo de abajo no salta con cada cambio.
              */}
              <span className="grid">
                {rota
                  ? palabras.map((p, i) => (
                      <span
                        key={i}
                        className="invisible col-start-1 row-start-1 text-balance"
                      >
                        {p}.
                      </span>
                    ))
                  : null}
                <span
                  key={palabra}
                  className={cn(
                    "col-start-1 row-start-1 text-balance",
                    rota && "motion-safe:animate-palabra",
                  )}
                >
                  {palabra}.
                </span>
              </span>
            </span>
          </h1>
          {children}
        </div>

        {tiras.length > 0 ? (
          <div className="relative -mx-4 sm:-mx-6 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mx-0 lg:h-full">
            <div
              ref={zona}
              // Decorativas: las categorías están en los chips. El botón de
              // pausa va afuera: adentro de un `aria-hidden` no se podría usar.
              aria-hidden
              className="relative flex flex-col gap-2.5 select-none sm:gap-3 lg:grid lg:h-full lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)] lg:[mask-image:linear-gradient(180deg,transparent,#000_7%,#000_90%,transparent)]"
            >
              {tiras.map((piezas, t) => (
                <div
                  key={t}
                  data-tira
                  className={cn(
                    "relative min-w-0 cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing lg:touch-auto",
                    t === 2 && "max-lg:hidden",
                  )}
                >
                  <div data-cinta className="flex w-max lg:w-full lg:flex-col">
                    {/* Dos veces la misma tira: al dar la vuelta, empalma. */}
                    {[0, 1].map((copia) => (
                      <div
                        key={copia}
                        data-copia
                        // Sin aire propio: en el empalme dejaría un hueco mayor.
                        className="flex shrink-0 lg:flex-col"
                      >
                        {piezas.map((pieza, i) => {
                          const c = categorias[pieza.categoria];
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
                                    // Sin diferir: cualquiera puede ser el
                                    // LCP, y son a lo sumo seis direcciones.
                                    loading="eager"
                                    sizes="(min-width: 1024px) 220px, 144px"
                                    className="pointer-events-none object-cover"
                                  />
                                  {/* Adentro: afuera lo cortaría la columna. */}
                                  <span
                                    className={cn(
                                      // La línea blanca: sobre una foto oscura la tinta no se ve.
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
                title={
                  detenido ? "Reanudar el movimiento" : "Pausar el movimiento"
                }
                className="absolute right-4 bottom-2 z-30 grid size-11 lg:right-3 lg:bottom-3 place-items-center rounded-pill bg-surface/95 text-ink-secondary shadow-md transition-colors duration-150 hover:text-ink"
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

        {chips ? (
          <div className="lg:col-start-1 lg:row-start-3">{chips}</div>
        ) : null}
      </div>
    </section>
  );
}
