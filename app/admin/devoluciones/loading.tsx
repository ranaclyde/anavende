import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del listado de devoluciones — DR §8: tarjetas fantasma del alto real,
 * no un spinner centrado. Se dibujan también el encabezado y la barra de
 * filtros, así nada salta hacia abajo cuando llegan los datos.
 */
export default function CargandoDevoluciones() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          <Skeleton className="h-10 rounded-panel-control md:w-56" />
          <Skeleton className="h-10 rounded-panel-control md:w-48" />
          <Skeleton className="h-10 rounded-panel-control md:w-80" />
        </div>
        <Skeleton className="h-4 w-28" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-panel-card" />
        ))}
      </div>
    </div>
  );
}
