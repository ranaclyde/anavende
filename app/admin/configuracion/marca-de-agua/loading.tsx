import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga de la marca de agua — DESIGN-REFERENCE §8: la forma real, con la
 * vista previa al costado en el mismo umbral que la pantalla.
 */
export default function CargandoMarcaDeAgua() {
  return (
    <div className="flex w-full flex-col gap-4">
      <EsqueletoDeEncabezado titulo="w-44" bajada="w-full max-w-lg" />
      <div className="@container w-full max-w-admin-form">
        <div className="grid items-start gap-4 @min-[52rem]:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="flex flex-col gap-4">
            <Tarjeta alto="h-10 w-60" />
            <Tarjeta alto="h-64 w-full" />
          </div>
          <Tarjeta alto="aspect-[4/3] w-full" />
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ alto }: { alto: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-full" />
      </div>
      <Skeleton className={`${alto} rounded-panel-control`} />
    </div>
  );
}
