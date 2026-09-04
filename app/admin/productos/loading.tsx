import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del listado — DESIGN-REFERENCE §6.9 y §8: filas fantasma del alto
 * real, no un spinner centrado. Se dibujan también el encabezado y la barra
 * de filtros, que es la parte que más se nota: si aparecieran después, los
 * primeros resultados saltarían 90px hacia abajo justo cuando se los está
 * mirando.
 */
export default function CargandoProductos() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36 rounded-panel-control" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          <Skeleton className="h-10 flex-1 rounded-panel-control md:min-w-64" />
          <div className="grid grid-cols-2 gap-2 md:flex">
            {[44, 44, 40, 40].map((ancho, i) => (
              <Skeleton
                key={i}
                className="h-10 rounded-panel-control"
                style={{ width: `${ancho * 0.25}rem` }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-56 rounded-panel-control" />
        </div>
      </div>

      <div className="overflow-hidden rounded-panel-card border border-border bg-surface">
        <div className="h-9 border-b border-border bg-surface-sunken" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-4 border-b border-border px-3 last:border-b-0"
          >
            <Skeleton className="h-4 max-w-48 flex-1" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
