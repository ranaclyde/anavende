import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Encabezado de una pantalla del panel — DR §6.9.
 *
 * Existe porque hasta el 2026-09-21 no existía: las **trece** pantallas del
 * panel lo escribían a mano y habían terminado con cinco formas distintas de
 * la misma cosa. Dos se llevaban peor que el resto:
 *
 * - **El «volver» tenía dos markups.** Cuatro pantallas usaban un botón
 *   terciario; la ficha de producto, un `<Link>` pintado a mano en
 *   `body-sm`/`ink-secondary`. A la vista eran 32px contra 20px, un color
 *   distinto y la mitad del área para el dedo — en la misma posición de la
 *   misma pantalla.
 * - **Los listados alineaban arriba y las fichas al medio.** No eran dos
 *   criterios: es la misma regla mirada en dos formas. Cuando la columna
 *   izquierda son dos renglones —título y bajada— el botón de la derecha se
 *   alinea con el título y no flota en el medio; cuando es uno solo, se
 *   centra. Acá se decide una vez y ninguna pantalla vuelve a elegir.
 *
 * Las piezas opcionales son las que de verdad varían: no toda pantalla vuelve
 * a algún lado, no toda tiene bajada, no toda tiene insignias ni acciones.
 */
export function EncabezadoDePanel({
  titulo,
  bajada,
  volver,
  insignias,
  acciones,
}: {
  titulo: React.ReactNode;
  /** La frase bajo el título. Las fichas no la tienen: ahí el título es un dato. */
  bajada?: React.ReactNode;
  /** A dónde se sale, con el nombre de lo que se abre. */
  volver?: { href: string; etiqueta: string };
  /** Las píldoras de estado, al lado del título. */
  insignias?: React.ReactNode;
  /** Lo que se puede hacer desde acá, arriba a la derecha. */
  acciones?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {volver ? (
        // `self-start` para que no se estire a lo ancho de la columna, y
        // `-ml-3` para que el texto del botón caiga sobre el mismo eje que el
        // título: el relleno del terciario lo corría tres píxeles.
        <Button
          asChild
          variant="tertiary"
          size="sm"
          className="-ml-3 self-start"
        >
          <Link href={volver.href}>
            <ChevronLeft aria-hidden />
            {volver.etiqueta}
          </Link>
        </Button>
      ) : null}

      <div
        className={`flex flex-wrap justify-between gap-3 ${
          bajada ? "items-start" : "items-center"
        }`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-title text-ink">{titulo}</h1>
            {insignias}
          </div>
          {bajada ? (
            <p className="text-body-sm text-ink-secondary">{bajada}</p>
          ) : null}
        </div>

        {acciones}
      </div>
    </div>
  );
}

/**
 * El fantasma del encabezado, para los `loading.tsx` — DR §8.
 *
 * Vive **en este archivo** y no en cada esqueleto a propósito: el esqueleto y
 * lo real tienen que medir lo mismo, y la única forma de que no se separen
 * con el tiempo es que se editen en la misma pantalla. Antes no era así, y
 * por eso el esqueleto de la ficha de producto dibujaba el «volver» de 20px
 * cuando el de verdad mide 32.
 *
 * Los anchos van por parámetro porque son lo único que el esqueleto no puede
 * saber: «Panel» y «Nuevo producto» no miden igual.
 */
export function EsqueletoDeEncabezado({
  titulo,
  bajada,
  volver,
  insignias = 0,
  acciones = [],
}: {
  /** El ancho del título, del largo del de verdad: `w-40`. */
  titulo: string;
  /** El ancho de la bajada, o nada si esta pantalla no tiene. */
  bajada?: string;
  /** El ancho del botón de volver, o nada si la pantalla no vuelve. */
  volver?: string;
  /** Cuántas píldoras van al lado del título. */
  insignias?: number;
  /** El ancho de cada botón de la derecha. */
  acciones?: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* `h-8` es el alto del botón terciario `sm`. */}
      {volver ? (
        <Skeleton
          className={`h-8 self-start rounded-panel-control ${volver}`}
        />
      ) : null}

      <div
        className={`flex flex-wrap justify-between gap-3 ${
          bajada ? "items-start" : "items-center"
        }`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            {/* `h-7`: el `text-title` real mide 29px, no 24. */}
            <Skeleton className={`h-7 ${titulo}`} />
            {Array.from({ length: insignias }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-20 rounded-pill" />
            ))}
          </div>
          {bajada ? <Skeleton className={`h-5 ${bajada}`} /> : null}
        </div>

        {acciones.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {acciones.map((ancho, i) => (
              <Skeleton
                key={i}
                className={`h-8 rounded-panel-control ${ancho}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
