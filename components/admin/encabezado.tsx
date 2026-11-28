import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Encabezado de una pantalla del panel — DR §6.12. */
export function EncabezadoDePanel({
  titulo,
  bajada,
  volver,
  insignias,
  acciones,
  retrato,
}: {
  titulo: React.ReactNode;
  /**
   * Lo que va a la izquierda del título, a la altura de las dos líneas: la
   * cara de un usuario.
   */
  retrato?: React.ReactNode;
  /** La frase bajo el título. Las fichas no la tienen: ahí el título es un dato. */
  bajada?: React.ReactNode;
  /** A dónde se sale, con el nombre de lo que se abre. */
  volver?: { href: string; etiqueta: string };
  insignias?: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {volver ? (
        // `-ml-3`: el relleno del terciario corría el texto del eje del título.
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
        {/* Crece y parte su texto en vez de empujar las acciones abajo. */}
        <div className="flex min-w-0 flex-1 basis-80 items-center gap-4">
          {retrato}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-title text-ink">{titulo}</h1>
              {insignias}
            </div>
            {bajada ? (
              <p className="text-body-sm text-ink-secondary">{bajada}</p>
            ) : null}
          </div>
        </div>

        {acciones}
      </div>
    </div>
  );
}

/**
 * El fantasma del encabezado, para los `loading.tsx` — DR §8. Vive en este
 * archivo para que el esqueleto y lo real se editen juntos y midan lo mismo.
 */
export function EsqueletoDeEncabezado({
  titulo,
  bajada,
  volver,
  insignias = 0,
  acciones = [],
  retrato,
}: {
  /** El ancho del título, del largo del de verdad: `w-40`. */
  titulo: string;
  /** El tamaño del círculo a la izquierda del título, si la ficha lleva cara: `size-16`. */
  retrato?: string;
  /** El ancho de la bajada, o nada si esta pantalla no tiene. */
  bajada?: string;
  /** El ancho del botón de volver, o nada si la pantalla no vuelve. */
  volver?: string;
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
        <div className="flex min-w-0 flex-1 basis-80 items-center gap-4">
          {retrato ? (
            <Skeleton className={`shrink-0 rounded-pill ${retrato}`} />
          ) : null}
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
