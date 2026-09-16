import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del listado de usuarios — DR §6.9 y §8: filas fantasma del alto real.
 * Se dibujan también el encabezado y la barra de filtros, así las primeras
 * filas no saltan hacia abajo cuando llegan los datos.
 */
export default function CargandoUsuarios() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          <Skeleton className="h-10 flex-1 rounded-panel-control md:min-w-64" />
          <Skeleton className="h-10 rounded-panel-control md:w-48" />
          <Skeleton className="h-10 rounded-panel-control md:w-52" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="overflow-hidden rounded-panel-card border border-border bg-surface">
        <div className="h-9 border-b border-border bg-surface-sunken" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-4 border-b border-border px-3 last:border-b-0"
          >
            <Skeleton className="h-4 max-w-56 flex-1" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-8" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
