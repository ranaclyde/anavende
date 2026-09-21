import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga de la ficha de un usuario — DR §8. Tarea F7.6.
 *
 * Misma grilla de dos columnas que el detalle de una orden: los datos a la
 * izquierda y las acciones sobre la cuenta al costado en `xl`.
 */
export default function CargandoElUsuario() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-8 w-28 rounded-panel-control" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-28 rounded-pill" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-panel-control" />
          <Skeleton className="h-8 w-36 rounded-panel-control" />
        </div>
      </div>

      <Skeleton className="h-4 w-80 max-w-full" />

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex flex-col gap-4">
          {/* Datos de la persona, y sus órdenes */}
          <div className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4">
            <Skeleton className="h-4 w-36" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-10 w-full rounded-panel-control" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 max-w-40 flex-1" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Rol, bloqueo y baja */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-32 rounded-panel-control" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
