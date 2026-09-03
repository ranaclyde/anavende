import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del listado — DESIGN-REFERENCE §6.9: filas fantasma del alto real,
 * no un spinner centrado. La página no salta cuando llegan los datos.
 */
export default function CargandoCatalogo() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32 rounded-panel-control" />
      </div>
      <div className="overflow-hidden rounded-panel-card border border-border bg-surface">
        <div className="h-9 border-b border-border bg-surface-sunken" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-4 border-b border-border px-3 last:border-b-0"
          >
            <Skeleton className="h-4 flex-1 max-w-48" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
