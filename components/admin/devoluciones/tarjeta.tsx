import Link from "next/link";

import { AnularLaDevolucion } from "@/components/admin/devoluciones/anular";
import { Badge } from "@/components/ui/badge";
import { dateWithTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Devolucion, ItemDevuelto } from "@/modules/returns/queries";

/**
 * Tarjeta y no fila, también en escritorio: una devolución tiene un número
 * variable de renglones, y eso en una celda es una lista dentro de una tabla.
 */
export function TarjetaDeDevolucion({
  devolucion,
  orden,
}: {
  devolucion: Devolucion;
  /** En el listado general; en el detalle de la orden se omite. */
  orden?: { numero: number; customerName: string };
}) {
  const anulada = devolucion.estado === "anulada";

  return (
    <article
      className={`flex flex-col gap-3 rounded-panel-card border border-border p-4 ${
        // La anulada retrocede por superficie, no por `opacity` (DR §3.1).
        anulada ? "bg-surface-sunken" : "bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {orden ? (
              <Link
                href={`/admin/ordenes/${orden.numero}`}
                data-ayuda="orden-de-la-devolucion"
                className="text-body-sm font-medium text-ink hover:text-brand"
              >
                Orden #{orden.numero}
              </Link>
            ) : (
              <span className="text-body-sm font-medium text-ink">
                {devolucion.unidades === 1
                  ? "1 unidad devuelta"
                  : `${devolucion.unidades} unidades devueltas`}
              </span>
            )}
            {anulada ? <Badge tone="neutral">Anulada</Badge> : null}
          </div>

          <p className="text-caption text-ink-secondary">
            {orden ? `${orden.customerName} · ` : ""}
            <time dateTime={devolucion.creadaEn}>
              {dateWithTime(devolucion.creadaEn)}
            </time>
            {devolucion.autor ? ` · ${devolucion.autor}` : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-body-sm font-medium text-ink tabular-nums">
            {formatMoney(devolucion.monto)}
          </span>
          {orden ? (
            <span className="text-caption text-ink-secondary tabular-nums">
              {devolucion.unidades}{" "}
              {devolucion.unidades === 1 ? "unidad" : "unidades"}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {devolucion.items.map((item) => (
          <Renglon key={item.orderItemId} item={item} />
        ))}
      </ul>

      <p className="text-body-sm text-ink-secondary">
        <span className="text-ink-secondary">Motivo: </span>
        {devolucion.motivo}
      </p>

      {anulada ? (
        <p className="rounded-panel-control bg-surface-sunken px-3 py-2 text-caption text-ink-secondary">
          Anulada
          {devolucion.anuladaEn ? (
            <>
              {" el "}
              <time dateTime={devolucion.anuladaEn}>
                {dateWithTime(devolucion.anuladaEn)}
              </time>
            </>
          ) : null}
          {devolucion.motivoDeAnulacion
            ? `: ${devolucion.motivoDeAnulacion}`
            : ""}
          . Lo que había repuesto volvió a salir del stock y estas unidades se
          pueden devolver de nuevo.
        </p>
      ) : (
        // `self-end`: la guía resalta esta caja, que mide lo que el botón.
        <div data-ayuda="anular-devolucion" className="self-end">
          <AnularLaDevolucion
            returnId={devolucion.id}
            repuestas={devolucion.items
              .filter((item) => item.repone)
              .map((item) => ({
                nombre: nombrar(item),
                cantidad: item.cantidad,
              }))}
          />
        </div>
      )}
    </article>
  );
}

function nombrar(item: ItemDevuelto): string {
  return item.color
    ? `${item.nombre} (${item.color.toLowerCase()})`
    : item.nombre;
}

/** Dice siempre qué pasó con el stock: es lo único que lo explica después. */
function Renglon({ item }: { item: ItemDevuelto }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body-sm">
      <span className="text-ink tabular-nums">
        {item.cantidad} × {nombrar(item)}
      </span>
      <Badge
        tone={item.repone ? "success" : "warning"}
        data-ayuda="stock-de-la-devolucion"
      >
        {item.repone ? "Volvió al stock" : "No volvió al stock"}
      </Badge>
      {item.motivo ? (
        <span className="text-caption text-ink-secondary">{item.motivo}</span>
      ) : null}
    </li>
  );
}
