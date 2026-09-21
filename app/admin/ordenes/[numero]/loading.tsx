import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga del detalle de una orden — DR §8. Tarea F7.1.
 *
 * Reproduce la grilla de dos columnas de `page.tsx`, que **en `xl` pone la
 * tabla de ítems a la izquierda y la ficha del comprador al costado**: sin
 * eso, al llegar los datos el contenido saltaría de una columna a dos.
 *
 * El «Volver» sí se dibuja, y a propósito: en la página real está siempre, y
 * es la salida de emergencia de quien entró por un enlace equivocado. Un
 * esqueleto que lo esconde deja esa salida tapada justo mientras se espera.
 */
export default function CargandoLaOrden() {
  return (
    <div className="flex flex-col gap-4">
      <EsqueletoDeEncabezado
        titulo="w-36"
        volver="w-28"
        insignias={1}
        acciones={["w-28", "w-24"]}
      />

      <Skeleton className="h-4 w-64 max-w-full" />

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex flex-col gap-4">
          {/* La tabla de ítems: cabecera y filas del alto real (§6.9). */}
          <div className="overflow-hidden rounded-panel-card border border-border bg-surface">
            <div className="h-9 border-b border-border bg-surface-sunken" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex h-11 items-center gap-4 border-b border-border px-3"
              >
                <Skeleton className="h-4 max-w-56 flex-1" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
            <div className="flex items-center justify-end gap-3 px-3 py-3">
              <Skeleton className="h-6 w-32" />
            </div>
          </div>

          {/* Historial */}
          <div className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full max-w-80" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Comprador y entrega */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
