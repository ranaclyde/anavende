import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga de la ficha — DESIGN-REFERENCE §8: esqueletos con la FORMA REAL del
 * contenido, no un spinner centrado.
 *
 * Es la pantalla que más lo necesita de la tienda: se llega a ella tocando
 * una tarjeta del catálogo, y esa navegación espera al servidor. Sin esto, la
 * grilla se queda quieta después del toque y el segundo intento es tocar otra
 * vez —o volver—, que es como se pierde a alguien que ya había elegido.
 *
 * El cuadrado de la foto reserva su lugar con `aspect-square`, igual que la
 * ficha: el esqueleto y lo que llega ocupan lo mismo, así que la página no
 * salta cuando aparece la foto. Las miniaturas van a la IZQUIERDA y se
 * dibujan siempre, por el mismo motivo que en la galería de verdad (§6.8).
 */
export default function CargandoFicha() {
  return (
    <div className="mx-auto w-full max-w-shop px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex items-center gap-2 pb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="flex flex-col gap-3 self-start md:flex-row md:gap-4">
          <div className="hidden shrink-0 flex-col gap-2 md:flex">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="size-16 rounded-panel-image" />
            ))}
          </div>
          <Skeleton className="aspect-square min-w-0 flex-1 rounded-card" />
        </div>

        <div className="flex flex-col">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-64 max-w-full" />
          <Skeleton className="mt-4 h-8 w-40" />

          <div className="flex gap-3 pt-8">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="size-8 rounded-full" />
            ))}
          </div>

          <div className="flex items-center gap-4 pt-8">
            <Skeleton className="h-12 w-32 rounded-pill" />
            <Skeleton className="h-4 w-24" />
          </div>

          <Skeleton className="mt-5 h-12 w-full rounded-pill" />
          <Skeleton className="mt-2 h-12 w-full rounded-pill" />

          {/* Guardar y compartir. */}
          <div className="flex gap-2 pt-4">
            <Skeleton className="h-10 flex-1 rounded-pill" />
            <Skeleton className="h-10 flex-1 rounded-pill" />
          </div>

          {/* Los tres datos, «Sobre el producto» y el recuadro. */}
          <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6">
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>

          <Skeleton className="mt-8 h-5 w-40" />
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          <Skeleton className="mt-10 h-52 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
