import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoDevoluciones() {
  return (
    <div className="flex flex-col gap-4">
      <EsqueletoDeEncabezado titulo="w-40" bajada="w-96 max-w-full" />

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
