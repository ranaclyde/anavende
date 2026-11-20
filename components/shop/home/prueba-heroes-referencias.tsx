"use client";

/**
 * PRUEBA, en la rama `chore/prueba-heroes-con-fotos` (2026-11-20): el hero
 * nuevo de la home, «P · Columnas», sacado de Atrium MTL. Se ve con
 * `/?hero=p`; sin eso la home sigue con el hero de siempre. Las demás
 * variantes se descartaron.
 *
 * El texto grande a la izquierda y, a la derecha, tres columnas que corren
 * sin parar —la del medio para arriba, las de los costados para abajo— con
 * la foto de cada categoría destacada (F2.9) y un bloque de color con su
 * nombre. La palabra del eslogan rota por esas mismas categorías y la que
 * nombra se resalta en las columnas.
 */

import Image from "next/image";
import { type ReactNode } from "react";

import { MarcaDelHero } from "./marca-del-hero";
import { BotonPausa, useRotacion } from "./prueba-heroes";
import { cn } from "@/lib/utils";

export type CategoriaDelHero = {
  nombre: string;
  /** La foto de la categoría (F2.9), versión `card`; puede no tener. */
  imagenUrl: string | null;
};

/** Tonos suaves para los bloques, uno por categoría, en orden. */
const TINTES = [
  "236 196 168",
  "176 196 222",
  "190 210 178",
  "206 190 228",
  "228 214 170",
  "232 186 196",
  "180 214 214",
];

function conArticulo(categoria: string): string {
  const palabra = categoria.toLocaleLowerCase("es-AR");
  return `${/as$/.test(palabra) ? "las" : "los"} ${palabra}`;
}

type Pieza =
  | { tipo: "foto"; src: string; categoria: number }
  | { tipo: "color"; tinte: string; nombre: string; categoria: number };

/**
 * Cada categoría pone su foto (si tiene) y su bloque. Cada columna arranca
 * en otro lugar de la lista, para que no se vea lo mismo a la misma altura,
 * y la lista se repite hasta llenar la columna.
 */
function armarColumnas(categorias: CategoriaDelHero[]) {
  const lista: Pieza[] = categorias.flatMap((c, i) => {
    const bloque: Pieza = {
      tipo: "color",
      tinte: TINTES[i % TINTES.length],
      nombre: c.nombre,
      categoria: i,
    };
    return c.imagenUrl
      ? [{ tipo: "foto", src: c.imagenUrl, categoria: i } as Pieza, bloque]
      : [bloque];
  });
  if (lista.length === 0) return [];
  return [0, 1, 2].map((col) => {
    const corrida = Math.round((col * lista.length) / 3) + col;
    const piezas: Pieza[] = [];
    for (let k = 0; piezas.length < Math.max(6, lista.length); k++)
      piezas.push(lista[(corrida + k) % lista.length]);
    return { piezas, sube: col === 1, vuelta: [52, 44, 58][col] };
  });
}

/* ───────────────────────────── P · Columnas ──────────────────────────── */

export function HeroColumnas({
  categorias,
  buscador,
  aclaracion,
}: {
  /** Las destacadas, en el orden de la home. */
  categorias: CategoriaDelHero[];
  buscador: ReactNode;
  aclaracion: ReactNode;
}) {
  const { indice, quieto, detenido, setDetenido } = useRotacion(
    categorias.length,
  );
  const rota = !quieto && categorias.length > 0;
  const actual = rota ? indice % categorias.length : -1;
  const palabra = rota
    ? conArticulo(categorias[actual].nombre)
    : "la tecnología";
  const columnas = armarColumnas(categorias);
  const pausado = quieto || detenido;

  return (
    <div className="relative w-full overflow-hidden bg-canvas">
      <style href="prueba-columnas" precedence="default">{`
        @keyframes prueba-columna {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(0, -50%, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .prueba-columna { animation: none !important; }
        }
      `}</style>

      <div className="mx-auto grid max-w-shop gap-10 px-4 pt-10 sm:px-6 lg:h-[628px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:px-8 lg:py-8">
        {/* El texto */}
        <div className="relative z-10 flex flex-col items-start gap-6 text-left lg:justify-center lg:pb-10">
          <h1 className="flex flex-col items-start gap-5">
            <MarcaDelHero />
            <span className="sr-only">AnaVende: vos elegís la tecnología.</span>
            <span
              aria-hidden
              className="text-[clamp(2.5rem,5.2vw,4.5rem)] leading-[0.98] font-bold tracking-[-0.035em] text-balance text-ink"
            >
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
          <div className="w-full max-w-[520px]">{buscador}</div>
          <div className="max-w-[460px]">{aclaracion}</div>
        </div>

        {/* Las columnas */}
        <div
          aria-hidden
          className="relative -mx-4 grid h-[420px] grid-cols-3 gap-2.5 overflow-hidden px-4 sm:-mx-6 sm:h-[520px] sm:gap-3 sm:px-6 lg:mx-0 lg:h-full lg:px-0 [mask-image:linear-gradient(180deg,#000_88%,transparent)] lg:[mask-image:linear-gradient(180deg,transparent,#000_7%,#000_90%,transparent)]"
        >
          {columnas.map((columna, c) => (
            <div key={c} className="relative min-w-0">
              <div
                className="prueba-columna will-change-transform"
                style={{
                  animation: `prueba-columna ${columna.vuelta}s linear infinite${columna.sube ? "" : " reverse"}`,
                  animationPlayState: pausado ? "paused" : "running",
                  // Quietas, cada columna arranca a otra altura.
                  marginTop: c === 1 ? "-28%" : c === 2 ? "-56%" : undefined,
                }}
              >
                {/* Dos veces la misma tira: al llegar a la mitad, empalma. */}
                {[0, 1].map((copia) =>
                  columna.piezas.map((pieza, i) => (
                    <div
                      key={`${copia}-${i}`}
                      className={cn(
                        "pb-2.5 transition-opacity duration-500 sm:pb-3",
                        // La que nombra el eslogan, entera; las demás, un
                        // paso atrás.
                        actual >= 0 &&
                          pieza.categoria !== actual &&
                          "opacity-45",
                      )}
                    >
                      {pieza.tipo === "foto" ? (
                        <div className="relative aspect-[3/4] overflow-hidden rounded-[18px] bg-ink">
                          <Image
                            src={pieza.src}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 220px, 33vw"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className="flex aspect-[3/4] items-end rounded-[18px] p-3 text-caption font-semibold text-ink/70 sm:p-4 sm:text-body-sm"
                          style={{ backgroundColor: `rgb(${pieza.tinte})` }}
                        >
                          {pieza.nombre}
                        </div>
                      )}
                    </div>
                  )),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!quieto ? (
        <BotonPausa
          detenido={detenido}
          alternar={() => setDetenido((v) => !v)}
          className="absolute top-4 right-4 z-30"
        />
      ) : null}
    </div>
  );
}
