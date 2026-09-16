import Link from "next/link";

import { AnularLaDevolucion } from "@/components/admin/devoluciones/anular";
import { Badge } from "@/components/ui/badge";
import { fechaConHora } from "@/lib/fechas";
import { formatMoney } from "@/lib/money";
import type { Devolucion, ItemDevuelto } from "@/modules/returns/queries";

/**
 * Una devolución — FS RF-25. Tarea F7.5.
 *
 * **Es una tarjeta y no una fila de tabla, también en escritorio**, al revés
 * del listado de órdenes (§6.9). Una orden entra en una fila porque tiene un
 * total y un estado; una devolución tiene **un número variable de renglones**,
 * cada uno con su cantidad, su destino —vuelve al stock o se descarta— y a
 * veces su propio motivo. Meter eso en una celda es dibujar una lista adentro
 * de una tabla, que es una tabla peor.
 *
 * La misma pieza sirve en el listado general y en el detalle de la orden: lo
 * único que cambia es que allá hay que decir de qué orden es, y acá ya se sabe.
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
      className={`flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4 ${
        // La anulada se apaga: sigue estando —revertir stock deja rastro— pero
        // no es lo que cuenta. El color no es lo único que lo dice: arriba
        // lleva la etiqueta «Anulada» (§9).
        anulada ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {orden ? (
              <Link
                href={`/admin/ordenes/${orden.numero}`}
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

          <p className="text-caption text-ink-tertiary">
            {orden ? `${orden.customerName} · ` : ""}
            <time dateTime={devolucion.creadaEn}>
              {fechaConHora(devolucion.creadaEn)}
            </time>
            {devolucion.autor ? ` · ${devolucion.autor}` : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-body-sm font-medium text-ink tabular-nums">
            {formatMoney(devolucion.monto)}
          </span>
          {orden ? (
            <span className="text-caption text-ink-tertiary tabular-nums">
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
        <span className="text-ink-tertiary">Motivo: </span>
        {devolucion.motivo}
      </p>

      {anulada ? (
        <p className="rounded-panel-control bg-surface-sunken px-3 py-2 text-caption text-ink-secondary">
          Anulada
          {devolucion.anuladaEn ? (
            <>
              {" el "}
              <time dateTime={devolucion.anuladaEn}>
                {fechaConHora(devolucion.anuladaEn)}
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
        <div className="flex justify-end">
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

/** «Auricular Cloud II (negro)», como en el resto del panel. */
function nombrar(item: ItemDevuelto): string {
  return item.color
    ? `${item.nombre} (${item.color.toLowerCase()})`
    : item.nombre;
}

/**
 * Un renglón devuelto, **diciendo siempre qué pasó con el stock**.
 *
 * Es la mitad de RF-25 que no se ve en ningún otro lado: dos devoluciones de
 * dos unidades del mismo producto son cosas distintas según hayan vuelto a la
 * góndola o al tacho, y meses después esta línea es lo único que lo explica.
 */
function Renglon({ item }: { item: ItemDevuelto }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body-sm">
      <span className="text-ink tabular-nums">
        {item.cantidad} × {nombrar(item)}
      </span>
      <Badge tone={item.repone ? "success" : "warning"}>
        {item.repone ? "Volvió al stock" : "No volvió al stock"}
      </Badge>
      {item.motivo ? (
        <span className="text-caption text-ink-tertiary">{item.motivo}</span>
      ) : null}
    </li>
  );
}
