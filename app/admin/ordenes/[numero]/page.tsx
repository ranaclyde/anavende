import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { TarjetaDeDevolucion } from "@/components/admin/devoluciones/tarjeta";
import {
  EstadoDeLaOrden,
  OrigenDeLaOrden,
} from "@/components/admin/ordenes/estado";
import { AgregarALaOrden } from "@/components/admin/ordenes/agregar-item";
import { DevolverDeLaOrden } from "@/components/admin/ordenes/devolver";
import { EditarElRenglon } from "@/components/admin/ordenes/editar-item";
import { HistorialDeLaOrden } from "@/components/admin/ordenes/historial";
import { ResolverLaOrden } from "@/components/admin/ordenes/resolver";
import { AyudaGuiada, type PasoDeAyuda } from "@/components/ui/ayuda-guiada";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateWithTime, shortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { whatsappLink, messageToBuyer } from "@/lib/whatsapp";
import { formaDeEntrega } from "@/modules/orders/entrega";
import {
  leerOrdenDelPanel,
  type OrdenDelPanel,
} from "@/modules/orders/queries-panel";
import {
  devolucionesDeLaOrden,
  devueltasPorRenglon,
  type Devolucion,
} from "@/modules/returns/queries";
import { requireAdmin } from "@/lib/session";

type Props = { params: Promise<{ numero: string }> };

/**
 * Solo con la orden activa, que es cuando hay acciones. No repite el párrafo
 * de arriba de la tabla sobre el stock.
 */
const PASOS_DE_LA_ORDEN: PasoDeAyuda[] = [
  {
    elemento: "ajustar-renglon",
    titulo: "Ajustá cada producto",
    texto:
      "Con + y − cambiás la cantidad, y con el tacho lo sacás de la orden. Antes de confirmar vas a ver cuánto stock se mueve.",
  },
  {
    elemento: "agregar-a-la-orden",
    titulo: "¿Te pidió algo más?",
    texto:
      "Buscalo y sumalo. Un producto nuevo entra al precio de hoy; si ya estaba en la orden, se suma a su renglón con el precio que tenía.",
  },
  {
    elemento: "escribir-al-comprador",
    titulo: "Avisale los cambios",
    texto:
      "Al comprador no le llega ningún aviso cuando tocás la orden. Escribile desde acá: el mensaje ya sale con el número de la orden.",
  },
  {
    elemento: "resolver-orden",
    titulo: "Cuando se resuelve",
    texto:
      "Solo las finalizadas cuentan como ventas en Reportes. Si cancelás, el motivo que escribas lo puede leer el comprador.",
  },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { numero } = await params;
  return { title: `Orden #${numero}` };
}

/**
 * Detalle de una orden (RF-21). Cada estado tiene sus acciones: la activa se
 * edita, finaliza o cancela; la finalizada solo admite devoluciones (RF-25);
 * la cancelada no muestra controles.
 */
export default async function DetalleDeLaOrden({ params }: Props) {
  await requireAdmin();

  const { numero: crudo } = await params;

  // Sólo dígitos: `parseInt` aceptaría «1043abc» como 1043.
  if (!/^\d{1,9}$/.test(crudo)) notFound();

  const numero = Number.parseInt(crudo, 10);

  // Las devoluciones se piden siempre y en paralelo, por número: esperar a la
  // orden para filtrarlas sería una cascada.
  const [orden, devoluciones] = await Promise.all([
    leerOrdenDelPanel(numero),
    devolucionesDeLaOrden(numero),
  ]);
  if (!orden) notFound();

  // Solo cuentan las devoluciones vigentes: anular libera el cupo (RF-25).
  const devueltas = devueltasPorRenglon(devoluciones);
  const paraDevolver = orden.items
    .map((item) => ({
      id: item.id,
      nombre: item.nombre,
      color: item.color,
      cantidad: item.cantidad,
      yaDevueltas: devueltas.get(item.id) ?? 0,
      stock: item.stock,
    }))
    .filter((item) => item.cantidad > item.yaDevueltas);

  const direccion = orden.shippingAddress;
  const envio = formaDeEntrega(orden) === "envio" && direccion;

  return (
    <div className="flex flex-col gap-4">
      {/* Volver va al listado sin filtros: el atrás del navegador los conserva. */}
      <EncabezadoDePanel
        titulo={`Orden #${orden.numero}`}
        volver={{ href: "/admin/ordenes", etiqueta: "Órdenes" }}
        insignias={
          <>
            <EstadoDeLaOrden estado={orden.estado} />
            <OrigenDeLaOrden origen={orden.origen} />
          </>
        }
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {/* Siempre está: el teléfono es obligatorio en toda alta (RF-05).
                Secundario porque el de marca es «Finalizar» (§6.3). */}
            <Button asChild variant="secondary" size="sm">
              <a
                href={whatsappLink(
                  orden.customerPhone,
                  messageToBuyer(orden.numero),
                )}
                target="_blank"
                rel="noopener noreferrer"
                data-ayuda="escribir-al-comprador"
              >
                <IconoWhatsApp className="size-4" />
                Escribirle por WhatsApp
              </a>
            </Button>

            {/* RF-25: solo si queda algo por devolver. */}
            {orden.estado === "finalizada" && paraDevolver.length > 0 ? (
              <DevolverDeLaOrden numero={orden.numero} items={paraDevolver} />
            ) : null}

            {/* RF-23: solo desde `activa`, como dice `TRANSICIONES`. */}
            {orden.estado === "activa" ? (
              <ResolverLaOrden
                numero={orden.numero}
                // Solo lo que usan los diálogos: lo que viaja al cliente se
                // serializa entero.
                items={orden.items.map((item) => ({
                  id: item.id,
                  nombre: item.nombre,
                  color: item.color,
                  cantidad: item.cantidad,
                  disponible: item.disponible,
                  stock: item.stock,
                }))}
                loLeeElComprador={orden.cuenta !== null}
              />
            ) : null}

            {/* Al final: la acción que menos pesa. */}
            {orden.estado === "activa" ? (
              <AyudaGuiada
                id="panel-orden"
                pasos={PASOS_DE_LA_ORDEN}
                tamano="sm"
              />
            ) : null}
          </div>
        }
      />

      <p className="text-body-sm text-ink-secondary">
        Creada el {dateWithTime(orden.creadaEn)}
        {orden.finalizadaEn
          ? // Una manual cargada tarde (RF-24) tiene la venta antes de la
            // carga y a las 12:00 inventadas: se dice solo el día.
            new Date(orden.finalizadaEn) < new Date(orden.creadaEn)
            ? ` · venta del ${shortDate(orden.finalizadaEn)}`
            : ` · finalizada el ${dateWithTime(orden.finalizadaEn)}`
          : orden.canceladaEn
            ? ` · cancelada el ${dateWithTime(orden.canceladaEn)}`
            : ""}
      </p>

      {/* Fondo hundido y no punteado: en el panel el punteado dice «soltá
          archivos acá». */}
      {orden.estado === "activa" ? (
        <p className="rounded-panel-card bg-surface-sunken px-4 py-3 text-body-sm text-ink-secondary">
          Podés ajustar el pedido desde los renglones de abajo: quitar, bajar o
          sumar cantidades y agregar productos. Lo que saques vuelve al stock
          enseguida y lo que sumes se reserva, si hay. Cuando la entregues,
          finalizala: ahí se descuenta el stock de verdad. Ni finalizarla ni
          cancelarla tienen vuelta atrás.
        </p>
      ) : null}

      {/* El DOM sigue la columna del teléfono (pedido, entrega, historial al
          final) para el teclado y el lector; en escritorio la grilla sube el
          historial debajo del pedido. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-[auto_1fr] xl:items-start">
        <div className="flex flex-col gap-4 xl:col-start-1 xl:row-start-1">
          <Renglones orden={orden} />
          <Devoluciones devoluciones={devoluciones} />
        </div>

        <div className="flex flex-col gap-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <Ficha id="comprador" titulo="Comprador">
            <Dato titulo="A nombre de" valor={orden.customerName} />
            <Dato titulo="Teléfono" valor={orden.customerPhone} />
            <Dato
              titulo="Email"
              valor={orden.customerEmail}
              vacio="Sin email"
            />
            {/* La cuenta puede no ser la persona del pedido (compra para un
                tercero): verlas juntas evita escribirle al que no era. */}
            <Dato
              titulo="Cuenta"
              valor={
                orden.cuenta
                  ? `${orden.cuenta.nombre} · ${orden.cuenta.email}`
                  : null
              }
              vacio="Sin cuenta en la tienda"
            />
          </Ficha>

          <Ficha
            id="entrega"
            titulo={envio ? "Envío" : "Entrega"}
            texto={!envio}
          >
            {envio ? (
              <>
                <Dato titulo="Recibe" valor={direccion.recipientName} />
                <Dato
                  titulo="Dirección"
                  valor={`${direccion.street} ${direccion.number}${
                    direccion.apartment ? `, ${direccion.apartment}` : ""
                  }`}
                />
                <Dato
                  titulo="Localidad"
                  valor={`${direccion.city}, ${direccion.province}${
                    direccion.postalCode ? ` (${direccion.postalCode})` : ""
                  }`}
                />
                <Dato titulo="Teléfono" valor={direccion.phone} />
                <Dato titulo="Indicaciones" valor={direccion.notes ?? null} />
              </>
            ) : (
              <p className="text-body-sm text-ink">
                Retira en el punto de entrega.
              </p>
            )}
          </Ficha>

          {orden.notas ? (
            <Ficha id="notas" titulo="Notas" texto>
              <p className="text-body-sm whitespace-pre-line text-ink">
                {orden.notas}
              </p>
            </Ficha>
          ) : null}
        </div>

        <div className="xl:col-start-1 xl:row-start-2">
          <HistorialDeLaOrden entradas={orden.historial} />
        </div>
      </div>
    </div>
  );
}

/**
 * Todo sale del snapshot (RN-12), que dice lo que se vendió aunque el producto
 * haya cambiado; por eso no enlaza a su ficha.
 */
function Renglones({ orden }: { orden: OrdenDelPanel }) {
  // Solo decide qué se dibuja: la regla (RF-22) la hace cumplir `editar.ts`.
  const editable = orden.estado === "activa";
  const esElUnico = orden.items.length === 1;

  // Quitar el último renglón cancela la orden (RF-22): se explica acá.
  if (orden.items.length === 0) {
    return (
      <section className="rounded-panel-card border border-border bg-surface px-4 py-6 text-center">
        <p className="text-body-sm text-ink-secondary">
          No quedó ningún producto: se quitaron todos y por eso la orden está
          cancelada. El detalle de qué se sacó está en el historial.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="items"
      className="overflow-hidden rounded-panel-card border border-border bg-surface"
    >
      <h2 id="items" className="sr-only">
        Ítems de la orden
      </h2>

      {/* Escritorio */}
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow className="hover:bg-surface-sunken">
            {/* El color va debajo del nombre: con su columna, «Producto» no
                entraba al lado de la columna lateral. */}
            <TableHead>Producto</TableHead>
            <TableHead data-align="right" className="w-24">
              Cantidad
            </TableHead>
            <TableHead data-align="right" className="w-32">
              Precio
            </TableHead>
            <TableHead data-align="right" className="w-32">
              Subtotal
            </TableHead>
            {editable ? (
              <TableHead className="w-24 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orden.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">{item.nombre}</span>
                  <span className="text-caption text-ink-secondary">
                    {item.marca}
                    {item.color ? ` · ${item.color}` : ""}
                  </span>
                </div>
              </TableCell>
              <TableCell data-align="right">{item.cantidad}</TableCell>
              <TableCell data-align="right" className="text-ink-secondary">
                {formatMoney(item.precioUnitario)}
              </TableCell>
              <TableCell data-align="right" className="font-medium">
                {formatMoney(item.subtotal)}
              </TableCell>
              {editable ? (
                <TableCell className="text-right">
                  <EditarElRenglon
                    numero={orden.numero}
                    item={item}
                    esElUnico={esElUnico}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Móvil */}
      <ul className="flex flex-col md:hidden">
        {orden.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-1 border-b border-border p-3 last:border-b-0"
          >
            <span className="text-body-sm font-medium text-ink">
              {item.nombre}
            </span>
            <span className="text-caption text-ink-secondary">
              {item.marca}
              {item.color ? ` · ${item.color}` : ""}
            </span>
            <div className="flex items-baseline justify-between gap-3 tabular-nums">
              <span className="text-caption text-ink-secondary">
                {item.cantidad} × {formatMoney(item.precioUnitario)}
              </span>
              <span className="text-body-sm font-medium text-ink">
                {formatMoney(item.subtotal)}
              </span>
            </div>
            {editable ? (
              <EditarElRenglon
                numero={orden.numero}
                item={item}
                esElUnico={esElUnico}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {/* RF-22: agregar va con los renglones, no en la cabecera. */}
      {editable ? <AgregarALaOrden numero={orden.numero} /> : null}

      <div className="flex items-baseline justify-between gap-4 border-t border-border bg-surface-sunken px-3 py-3">
        <p className="text-body-sm text-ink">
          Total{" "}
          <span className="text-caption text-ink-secondary">
            ({orden.unidades} {orden.unidades === 1 ? "unidad" : "unidades"} en{" "}
            {orden.items.length}{" "}
            {orden.items.length === 1 ? "renglón" : "renglones"})
          </span>
        </p>
        <p className="text-body-lg font-medium text-ink tabular-nums">
          {formatMoney(orden.total)}
        </p>
      </div>
    </section>
  );
}

function Devoluciones({ devoluciones }: { devoluciones: Devolucion[] }) {
  if (devoluciones.length === 0) return null;

  return (
    <section aria-labelledby="devoluciones" className="flex flex-col gap-2">
      <h2 id="devoluciones" className="text-body-sm font-medium text-ink">
        Devoluciones
      </h2>
      <ul className="flex flex-col gap-2">
        {devoluciones.map((devolucion) => (
          <li key={devolucion.id}>
            <TarjetaDeDevolucion devolucion={devolucion} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Ficha({
  id,
  titulo,
  texto = false,
  children,
}: {
  id: string;
  titulo: string;
  /** Un párrafo y no rótulos con su dato: va sin `<dl>`, que solo admite esos. */
  texto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TarjetaDeSeccion id={id} titulo={titulo}>
      {texto ? children : <dl className="flex flex-col gap-2.5">{children}</dl>}
    </TarjetaDeSeccion>
  );
}

/** Con `vacio`, lo que falta se dice; sin él, el renglón se omite. */
function Dato({
  titulo,
  valor,
  vacio,
}: {
  titulo: string;
  valor: string | null;
  vacio?: string;
}) {
  if (!valor && !vacio) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-ink-secondary">{titulo}</dt>
      <dd
        className={
          valor ? "text-body-sm text-ink" : "text-body-sm text-ink-secondary"
        }
      >
        {valor ?? vacio}
      </dd>
    </div>
  );
}
