import { ChevronRight, Plus, Receipt } from "lucide-react";
import Link from "next/link";

import { VacioDelPanel } from "@/components/admin/vacio";
import {
  EstadoDeLaOrden,
  OrigenDeLaOrden,
} from "@/components/admin/ordenes/estado";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  hayFiltros,
  sinFiltros,
  urlDeFiltros,
  type FiltrosDeOrdenes,
} from "@/modules/orders/filtros-panel";
import type { OrdenDelListado } from "@/modules/orders/queries-panel";

export function ListadoDeOrdenes({
  ordenes,
  filtros,
}: {
  ordenes: OrdenDelListado[];
  filtros: FiltrosDeOrdenes;
}) {
  if (ordenes.length === 0) return <SinResultados filtros={filtros} />;

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-hidden rounded-panel-card border border-border bg-surface md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-surface-sunken">
              <TableHead className="w-40">Orden</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead data-align="right" className="w-28">
                Unidades
              </TableHead>
              <TableHead data-align="right" className="w-36">
                Total
              </TableHead>
              <TableHead className="w-32">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenes.map((orden) => (
              <TableRow key={orden.numero}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/ordenes/${orden.numero}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      #{orden.numero}
                    </Link>
                    <OrigenDeLaOrden origen={orden.origen} />
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-ink-secondary">
                  <Fecha iso={orden.creadaEn} />
                </TableCell>
                <TableCell>
                  <Comprador orden={orden} />
                </TableCell>
                <TableCell data-align="right">{orden.unidades}</TableCell>
                <TableCell data-align="right" className="font-medium">
                  {formatMoney(orden.total)}
                </TableCell>
                <TableCell>
                  <EstadoDeLaOrden estado={orden.estado} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Móvil: la tarjeta entera es el enlace. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {ordenes.map((orden) => (
          <li key={orden.numero}>
            <Link
              href={`/admin/ordenes/${orden.numero}`}
              className="flex items-center gap-3 rounded-panel-card border border-border bg-surface p-3 transition-colors duration-150 hover:bg-surface-sunken"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm font-medium text-ink">
                    #{orden.numero}
                  </span>
                  <EstadoDeLaOrden estado={orden.estado} />
                  <OrigenDeLaOrden origen={orden.origen} />
                </div>
                <Comprador orden={orden} />
                <span className="text-caption text-ink-secondary tabular-nums">
                  <Fecha iso={orden.creadaEn} /> · {orden.unidades}{" "}
                  {orden.unidades === 1 ? "unidad" : "unidades"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-body-sm font-medium text-ink tabular-nums">
                  {formatMoney(orden.total)}
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 text-ink-tertiary"
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** El nombre del snapshot, no el de la cuenta (RN-12). */
function Comprador({ orden }: { orden: OrdenDelListado }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-body-sm text-ink">
        {orden.customerName}
      </span>
      {orden.customerEmail ? (
        <span className="truncate text-caption text-ink-secondary">
          {orden.customerEmail}
        </span>
      ) : null}
    </div>
  );
}

/**
 * En el servidor y en la zona del negocio: en el navegador, la hidratación
 * no coincidiría.
 */
function Fecha({ iso }: { iso: string }) {
  return <time dateTime={iso}>{shortDate(iso)}</time>;
}

/** Sin resultados (§8): hay órdenes, pero ninguna coincide. */
function SinResultados({ filtros }: { filtros: FiltrosDeOrdenes }) {
  return (
    <VacioDelPanel
      titulo={
        filtros.q
          ? `No encontramos ninguna orden para «${filtros.q}».`
          : hayFiltros(filtros)
            ? "Ninguna orden coincide con los filtros."
            : "No hay órdenes en esta solapa."
      }
      accion={
        hayFiltros(filtros) ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={urlDeFiltros(sinFiltros(filtros))}>Limpiar todo</Link>
          </Button>
        ) : null
      }
    >
      {hayFiltros(filtros)
        ? "Probá con menos filtros, o revisá cómo quedó escrito."
        : null}
    </VacioDelPanel>
  );
}

export function SinOrdenes() {
  return (
    <VacioDelPanel
      icono={Receipt}
      titulo="Todavía no hay ninguna orden."
      accion={
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/ordenes/nueva">
            <Plus aria-hidden />
            Cargar una venta
          </Link>
        </Button>
      }
    >
      Cuando alguien confirme un pedido en la tienda vas a verlo acá, y te va a
      llegar un email con el detalle. Las ventas por WhatsApp o en persona se
      cargan a mano, y también cuentan.
    </VacioDelPanel>
  );
}
