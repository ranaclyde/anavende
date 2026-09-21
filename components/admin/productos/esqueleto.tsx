import { Skeleton } from "@/components/ui/skeleton";

/**
 * El fantasma del formulario de producto — DR §8.
 *
 * Vive acá y no en cada `loading.tsx` porque **lo usan las dos pantallas**,
 * el alta y la edición, y el formulario real también es uno solo
 * (`FormularioDeProducto`). Con una copia por pantalla, el día que el
 * formulario suma una sección hay que acordarse de dos lugares.
 *
 * Son las cuatro secciones de `formulario.tsx` —datos, precio, descripción y
 * publicación— con su alto real, más la barra de acciones al pie.
 */
export function EsqueletoDeFormularioDeProducto() {
  return (
    <div className="flex flex-col gap-6">
      {/* Datos del producto: nombre, y marca y categoría en dos columnas. */}
      <Seccion titulo="w-40">
        <Campo etiqueta="w-20" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="w-16" />
          <Campo etiqueta="w-20" />
        </div>
      </Seccion>

      {/* Precio y descuento, también en dos columnas. */}
      <Seccion titulo="w-20">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="w-14" />
          <Campo etiqueta="w-28" ayuda />
        </div>
        <Skeleton className="h-14 w-full rounded-panel-card" />
      </Seccion>

      {/* Descripción: barra de herramientas y caja de texto. */}
      <Seccion titulo="w-32" ayuda>
        <div className="overflow-hidden rounded-panel-control border border-border">
          <div className="h-11 border-b border-border bg-surface-sunken" />
          <Skeleton className="h-48 w-full rounded-none" />
        </div>
      </Seccion>

      {/* Publicación: son DOS casillas —activo y destacado—, y cada una lleva
          su renglón de ayuda debajo del rótulo. */}
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

      <div className="flex items-center justify-end gap-2">
        <Skeleton className="h-10 w-24 rounded-panel-control" />
        <Skeleton className="h-10 w-36 rounded-panel-control" />
      </div>
    </div>
  );
}

function Seccion({
  titulo,
  ayuda,
  children,
}: {
  /** El ancho del título fantasma, para que no midan todos lo mismo. */
  titulo: string;
  ayuda?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <Skeleton className={`h-6 ${titulo}`} />
        {ayuda ? <Skeleton className="h-5 w-full max-w-96" /> : null}
      </div>
      {children}
    </section>
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
