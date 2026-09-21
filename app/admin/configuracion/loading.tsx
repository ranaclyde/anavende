import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";
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
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EsqueletoDeEncabezado titulo="w-40" bajada="w-full max-w-md" />

      {/* Contacto: el WhatsApp. Su ayuda ocupa dos renglones y la de los
          avisos uno: es la diferencia que más se nota si el esqueleto la
          ignora. */}
      <Tarjeta campos={["sm:max-w-64"]} lineasDeAyuda={2} />
      {/* Avisos: el email y el umbral, que es angosto y lleva «unidades» al
          lado. Antes los tres campos medían `max-w-72`, que no es el ancho de
          ninguno. */}
      <Tarjeta campos={["sm:max-w-80", "w-20"]} lineasDeAyuda={1} />

      {/* La barra real lleva el «Todo guardado.» a la izquierda del botón, y
          `items-center gap-3`. Sin el texto, el botón quedaba solo y el
          renglón cambiaba de alto al llegar los datos. */}
      <div className="flex items-center justify-end gap-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-36 rounded-panel-control" />
      </div>

      {/* Modo mantenimiento: la tercera tarjeta, que el esqueleto no dibujaba.
          Está FUERA del formulario, debajo de la barra de acciones, así que
          al llegar los datos aparecía un bloque entero de la nada. */}
      <div className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4 sm:p-5">
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
  /** El ancho de cada campo, con el de la pantalla real. */
  campos: string[];
  lineasDeAyuda: number;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4 sm:p-5">
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
