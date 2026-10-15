import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga de los reportes — DR §8. Tarea F9.1.
 *
 * El período, los totales y el gráfico de ventas con su alto real: es lo que
 * entra en la primera pantalla, y lo de abajo llega antes de que se scrollee.
 */
export default function CargandoReportes() {
  return (
    // El mismo marco que la página: una columna de 1024 o, desde 1100px de
    // contenido, hasta 1680. Así nada cambia de ancho al llegar los datos.
    <div className="@container">
      <div className="flex max-w-admin-form flex-col gap-4 @min-[1100px]:max-w-[1680px]">
        <EsqueletoDeEncabezado titulo="w-28" bajada="w-80 max-w-full" />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-10 w-full max-w-md rounded-panel-control" />
          <Skeleton className="h-10 w-80 max-w-full rounded-panel-control" />
        </div>

        <section className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-0.5 rounded-panel-card border border-border p-3"
              >
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="my-0.5 h-6 w-28" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-56 w-full" />
        </section>
      </div>
    </div>
  );
}
