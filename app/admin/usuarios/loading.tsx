import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del listado de usuarios — DR §6.9 y §8: filas fantasma del alto real.
 * Se dibujan también el encabezado y la barra de filtros, así las primeras
 * filas no saltan hacia abajo cuando llegan los datos.
 */
export default function CargandoUsuarios() {
  return (
    <div className="flex flex-col gap-4">
      {/* El botón primario va: en esta pantalla está SIEMPRE, y sin él el
          encabezado se reacomodaba al llegar los datos. */}
      <EsqueletoDeEncabezado
        titulo="w-32"
        bajada="w-96 max-w-full"
        acciones={["w-36"]}
      />

      {/* La tira de solapas: 40px, los mismos que mide el segmentado real
          (§6.9). Desde el 2026-09-21 el estado es solapa y no desplegable, así
          que acá hay una tira más y un campo menos que antes. */}
      <Skeleton className="h-10 w-96 max-w-full rounded-panel-control" />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          <Skeleton className="h-10 flex-1 rounded-panel-control md:min-w-64" />
          <Skeleton className="h-10 rounded-panel-control md:w-48" />
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
