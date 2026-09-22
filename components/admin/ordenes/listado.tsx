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
import { fechaCorta } from "@/lib/fechas";
import { formatMoney } from "@/lib/money";
import {
  hayFiltros,
  sinFiltros,
  urlDeFiltros,
  type FiltrosDeOrdenes,
} from "@/modules/orders/filtros-panel";
import type { OrdenDelListado } from "@/modules/orders/queries-panel";

/**
 * Listado de órdenes del panel — RF-21, DR §6.9. Tarea F7.1.
 *
 * **Es un componente de servidor**, al revés del listado de productos: acá no
 * hay nada que tocar. Las solapas, los filtros y la paginación son enlaces, y
 * las acciones sobre una orden —editarla (F7.2), finalizarla o cancelarla
 * (F7.3)— viven en el detalle, con el pedido enfrente. Mandar esta tabla al
 * navegador sería pagar JavaScript por una lista de enlaces.
 *
 * En móvil la tabla se vuelve tarjetas, no scroll horizontal (§6.9).
 *
 * **No se ordena por columna.** El listado va siempre de la más nueva a la
 * más vieja, que es como se trabaja: lo que llegó hoy es lo que hay que
 * atender. Buscar una vieja es la búsqueda y el rango de fechas, no ordenar
 * quince mil filas al revés.
 */
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

      {/* Móvil: la tarjeta entera es el enlace. Es la única acción que tiene
          el renglón, y un área táctil del alto de la tarjeta se acierta con
          el pulgar (§9). */}
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
                <span className="text-caption text-ink-tertiary tabular-nums">
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

/**
 * El comprador: el nombre del pedido arriba y el email debajo.
 *
 * El nombre es el del **snapshot**, no el de la cuenta (RN-12, F6.1): quien
 * compró para un tercero puso los datos del tercero, y con esa persona es con
 * quien hay que coordinar. El email puede faltar en una orden manual (RF-24).
 */
function Comprador({ orden }: { orden: OrdenDelListado }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-body-sm text-ink">
        {orden.customerName}
      </span>
      {orden.customerEmail ? (
        <span className="truncate text-caption text-ink-tertiary">
          {orden.customerEmail}
        </span>
      ) : null}
    </div>
  );
}

/**
 * La fecha, formateada **en el servidor y en la zona del negocio**
 * (`lib/fechas.ts`). Hacerlo en el navegador significa que el servidor pinta
 * una cosa y la hidratación pinta otra, que es el parpadeo que §8 pide
 * evitar; y sin zona explícita, una orden de las 22:00 aparecería con la
 * fecha del día siguiente.
 */
function Fecha({ iso }: { iso: string }) {
  return <time dateTime={iso}>{fechaCorta(iso)}</time>;
}

/**
 * Sin resultados (§8), que no es lo mismo que vacío: acá hay órdenes y
 * ninguna coincide. Se repite el término buscado —para ver el error de tipeo
 * sin volver al campo— y se ofrece limpiar los filtros de una.
 */
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

/**
 * Estado vacío de verdad (§8): no hay ninguna orden todavía, en ninguna
 * solapa. No ofrece «cargar la primera» porque la orden manual es F7.4: hasta
 * entonces, las órdenes las hace la tienda y acá no hay ningún primer paso
 * que dar.
 */
export function SinOrdenes() {
  return (
    <VacioDelPanel
      icono={Receipt}
      titulo="Todavía no hay ninguna orden."
      accion={
        /* La acción sugerida que pide §6.9: sin órdenes web todavía, cargar
           una a mano es lo único que se puede hacer desde esta pantalla. */
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
