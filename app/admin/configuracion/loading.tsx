import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga de la configuración — DESIGN-REFERENCE §8: la forma real del
 * contenido, no un spinner.
 *
 * Las medidas y las separaciones son las MISMAS que las de la pantalla de
 * verdad —encabezado con `gap-1`, campos con `gap-1.5`, tarjetas con
 * `gap-4`—, que es lo único que hace que no salte cuando llegan los datos.
 * Un esqueleto con la forma parecida y el aire distinto es un salto igual,
 * solo que más difícil de ver de dónde viene.
 */
export default function CargandoConfiguracion() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>

      {/* La ayuda del número de WhatsApp ocupa dos renglones y la de los
          avisos uno: es la diferencia que más se nota si el esqueleto la
          ignora. */}
      <Tarjeta campos={1} lineasDeAyuda={2} />
      <Tarjeta campos={2} lineasDeAyuda={1} />

      <div className="flex justify-end">
        <Skeleton className="h-9 w-36 rounded-panel-control" />
      </div>
    </div>
  );
}

function Tarjeta({
  campos,
  lineasDeAyuda,
}: {
  campos: number;
  lineasDeAyuda: number;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-panel-card bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-64" />
      </div>
      {Array.from({ length: campos }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full max-w-72 rounded-panel-control" />
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
