import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Medidas y separaciones iguales a las de la pantalla real: si el aire cambia,
 * salta al llegar los datos.
 */
export default function CargandoConfiguracion() {
  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EsqueletoDeEncabezado titulo="w-40" bajada="w-full max-w-md" />

      {/* Contacto: sus ayudas ocupan dos renglones. */}
      <Tarjeta
        campos={["sm:max-w-64", "sm:max-w-96", "sm:max-w-96"]}
        lineasDeAyuda={2}
      />
      {/* Avisos: el email y el umbral, angosto. */}
      <Tarjeta campos={["sm:max-w-80", "w-20"]} lineasDeAyuda={1} />

      {/* El estado de guardado a la izquierda, o el renglón cambia de alto. */}
      <div className="flex items-center justify-end gap-3">
        <Skeleton className="mr-auto h-5 w-28" />
        <Skeleton className="h-9 w-36 rounded-panel-control" />
      </div>

      {/* Modo mantenimiento, fuera del formulario. */}
      <div className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-20 rounded-pill" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <Skeleton className="h-10 w-56 rounded-panel-control" />
      </div>
    </div>
  );
}

function Tarjeta({
  campos,
  lineasDeAyuda,
}: {
  campos: string[];
  lineasDeAyuda: number;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-64" />
      </div>
      {campos.map((ancho, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className={`h-10 w-full rounded-panel-control ${ancho}`} />
          <div className="flex flex-col gap-1">
            {Array.from({ length: lineasDeAyuda }).map((_, l) => (
              <Skeleton
                key={l}
                className={l === lineasDeAyuda - 1 ? "h-4 w-2/3" : "h-4 w-full"}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
