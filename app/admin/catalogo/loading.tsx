import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cubre solo los hijos del layout: el encabezado y las solapas no esperan.
 * Cuatro columnas, las de marcas, categorías y colores; medios de pago tiene
 * tres y comparte este esqueleto a propósito.
 */
export default function CargandoCatalogo() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-32 rounded-panel-control" />
      </div>
      <div className="overflow-hidden rounded-panel-card border border-border bg-surface">
        <div className="h-9 border-b border-border bg-surface-sunken" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-4 border-b border-border px-3 last:border-b-0"
          >
            <Skeleton className="h-4 max-w-48 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
