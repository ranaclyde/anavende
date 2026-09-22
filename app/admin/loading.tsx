import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del inicio del panel — DR §8. Tarea F7.8.
 *
 * **Es la pantalla de entrada y era la única sin esqueleto**, aunque
 * `page.tsx` espera tres consultas antes de pintar nada: el umbral de stock
 * y, con él, los dos bloques. Hasta el 2026-09-21 quien abría el panel veía
 * el menú y un hueco.
 *
 * Dibuja las dos tarjetas con su alto real para que nada salte al llegar los
 * datos. **Los tres renglones de «Para hacer» son un máximo, no una
 * promesa**: si no hay nada pendiente, el bloque real es una sola línea. Se
 * eligió el caso lleno porque encoger no mueve lo de abajo tanto como crecer.
 */
export default function CargandoElPanel() {
  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EsqueletoDeEncabezado titulo="w-24" bajada="w-72 max-w-full" />

      {/* Para hacer */}
      <section className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
        <Skeleton className="h-6 w-28" />
        <div className="flex flex-col divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <Skeleton className="h-4 max-w-64 flex-1" />
              <Skeleton className="h-8 w-16 shrink-0 rounded-panel-control" />
            </div>
          ))}
        </div>
      </section>

      {/* Este mes */}
      <section className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
    </div>
  );
}
