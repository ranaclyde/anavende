import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del listado — DR §6.9 y §8: filas fantasma del alto real, no un
 * spinner centrado. Se dibujan también el encabezado, las solapas y la barra
 * de filtros: si aparecieran después, las primeras filas saltarían cien
 * píxeles hacia abajo justo cuando se las está mirando.
 *
 * **Por qué el listado vive en un grupo `(listado)` y no en `ordenes/` a
 * secas.** Un `loading.tsx` envuelve su segmento Y TODOS SUS HIJOS en un
 * Suspense, así que puesto en `ordenes/` también cubría a `[numero]`: la
 * cáscara del panel salía a la calle antes de que la consulta del detalle
 * terminara, y cuando esa consulta no encontraba la orden, el `notFound()`
 * llegaba con la respuesta ya empezada — **200 y una pantalla vacía** en
 * lugar de un 404 con la página de «no encontramos esto». Se vio con
 * Playwright, no con los tests. El grupo no cambia ninguna dirección
 * (`(listado)/page.tsx` sigue siendo `/admin/ordenes`) y deja el esqueleto
 * donde tiene que estar: sobre la tabla y sólo sobre la tabla.
 */
export default function CargandoOrdenes() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-10 w-72 max-w-full rounded-panel-control" />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          <Skeleton className="h-10 flex-1 rounded-panel-control md:min-w-64" />
          <Skeleton className="h-10 rounded-panel-control md:w-44" />
          <Skeleton className="h-10 rounded-panel-control md:w-80" />
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
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 max-w-48 flex-1" />
            <Skeleton className="ml-auto h-4 w-10" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
