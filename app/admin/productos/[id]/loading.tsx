import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
import { EsqueletoDeFormularioDeProducto } from "@/components/admin/productos/esqueleto";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga de la edición de un producto — DR §8. Tarea F2.3.
 *
 * El mismo formulario que el alta, **más la tarjeta de colores y stock**, que
 * en esta pantalla es hermana del `<form>` y no hija (F2.4). Sin ella el
 * esqueleto mediría bastante menos que la página y el pie saltaría.
 *
 * **Repite el reparto en dos columnas de la ficha**, no una aproximación: si
 * el esqueleto se dibujara en una sola, al llegar el contenido la tarjeta de
 * stock saltaría de abajo de todo al costado, que es el salto que un
 * esqueleto existe para evitar. Incluida la consulta de contenedor, que es la
 * que decide si hay una columna o dos.
 */
export default function CargandoLaEdicion() {
  return (
    <div className="flex w-full flex-col gap-4">
      <EsqueletoDeEncabezado titulo="w-64" volver="w-28" />

      <div className="@container">
        <div className="flex max-w-admin-form flex-col gap-4 @min-[1400px]:max-w-none @min-[1400px]:flex-row @min-[1400px]:items-start">
          <div className="min-w-0 @min-[1400px]:w-admin-form @min-[1400px]:shrink-0">
            <EsqueletoDeFormularioDeProducto />
          </div>

          <div className="min-w-0 @min-[1400px]:flex-1">
            {/* Colores y stock */}
            <section className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
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
                      <Skeleton
                        key={j}
                        className="size-16 rounded-panel-image"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
