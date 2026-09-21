import { EsqueletoDeFormularioDeProducto } from "@/components/admin/productos/esqueleto";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga de la edición de un producto — DR §8. Tarea F2.3.
 *
 * El mismo formulario que el alta, **más la tarjeta de colores y stock**, que
 * en esta pantalla va debajo y fuera del `<form>` (F2.4). Sin ella el
 * esqueleto mediría bastante menos que la página y el pie saltaría.
 */
export default function CargandoLaEdicion() {
  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <Skeleton className="h-5 w-24 self-start" />
      <Skeleton className="h-7 w-64" />
      <EsqueletoDeFormularioDeProducto />

      {/* Colores y stock */}
      <section className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-96" />
          </div>
          <Skeleton className="h-8 w-32 rounded-panel-control" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface-sunken p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20 rounded-panel-control" />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="size-16 rounded-panel-image" />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
