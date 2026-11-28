import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lo usan el alta y la edición. Copia la tarjeta de `formulario.tsx` con su
 * alto real: si el formulario cambia, cambia esto también.
 */
export function EsqueletoDeFormularioDeProducto() {
  return (
    <section className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
      {/* Datos: nombre, marca y categoría. */}
      <Skeleton className="h-6 w-40" />
      <Campo etiqueta="w-20" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="w-16" />
        <Campo etiqueta="w-20" />
      </div>

      {/* Precio y descuento. */}
      <Seccion titulo="w-20">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="w-14" />
          <Campo etiqueta="w-28" ayuda />
        </div>
        <Skeleton className="h-14 w-full rounded-panel-card" />
      </Seccion>

      {/* Descripción. */}
      <Seccion titulo="w-32" ayuda>
        <div className="overflow-hidden rounded-panel-control border border-border">
          <div className="h-11 border-b border-border bg-surface-sunken" />
          <Skeleton className="h-48 w-full rounded-none" />
        </div>
      </Seccion>

      {/* Publicación: activo y destacado, cada una con su ayuda. */}
      <Seccion titulo="w-28">
        {["w-44", "w-36"].map((ancho) => (
          <div key={ancho} className="flex items-start gap-3">
            <Skeleton className="mt-0.5 size-5 shrink-0 rounded-panel-control" />
            <div className="flex flex-1 flex-col gap-0.5">
              <Skeleton className={`h-5 ${ancho}`} />
              <Skeleton className="h-4 w-full max-w-96" />
            </div>
          </div>
        ))}
      </Seccion>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Skeleton className="h-10 w-24 rounded-panel-control" />
        <Skeleton className="h-10 w-36 rounded-panel-control" />
      </div>
    </section>
  );
}

function Seccion({
  titulo,
  ayuda,
  children,
}: {
  /** Clase de ancho del título fantasma. */
  titulo: string;
  ayuda?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <Skeleton className={`h-5 ${titulo}`} />
        {ayuda ? <Skeleton className="h-5 w-full max-w-96" /> : null}
      </div>
      {children}
    </div>
  );
}

function Campo({ etiqueta, ayuda }: { etiqueta: string; ayuda?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className={`h-5 ${etiqueta}`} />
      <Skeleton className="h-10 w-full rounded-panel-control" />
      {ayuda ? <Skeleton className="h-4 w-full max-w-72" /> : null}
    </div>
  );
}
