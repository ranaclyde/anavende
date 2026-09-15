import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EstadoDeLaOrden,
  OrigenDeLaOrden,
} from "@/components/admin/ordenes/estado";
import { EditarElRenglon } from "@/components/admin/ordenes/editar-item";
import { HistorialDeLaOrden } from "@/components/admin/ordenes/historial";
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
import { fechaConHora } from "@/lib/fechas";
import { formatMoney } from "@/lib/money";
import { enlaceDeWhatsApp, mensajeParaElComprador } from "@/lib/whatsapp";
import { formaDeEntrega } from "@/modules/orders/entrega";
import {
  leerOrdenDelPanel,
  type OrdenDelPanel,
} from "@/modules/orders/queries-panel";

type Props = { params: Promise<{ numero: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { numero } = await params;
  return { title: `Orden #${numero}` };
}

/**
 * Detalle de una orden — RF-21, DR §6.9. Tarea F7.1.
 *
 * Tiene lo que RF-21 pide y en ese orden: los ítems con precio unitario y
 * subtotal, el total, los datos del comprador, la dirección de envío, el
 * historial de estados y el acceso directo a su WhatsApp.
 *
 * **No es el detalle del comprador** (`/mi-cuenta/compras/[numero]`, F6.5).
 * Aquél cuenta en qué anda su pedido; éste es la hoja de trabajo: lleva el
 * teléfono, el email, la dirección entera y quién movió qué cosa cuándo.
 *
 * **Todavía no tiene botones de acción.** Editar es F7.2 y finalizar o
 * cancelar es F7.3; hasta entonces la pantalla lo dice, en vez de mostrar
 * controles apagados sin explicación. Es el mismo criterio con el que F5.8
 * dejó el bloque de bajas enlazando a una sección que no existía.
 */
export default async function DetalleDeLaOrden({ params }: Props) {
  const { numero: crudo } = await params;

  // Sólo dígitos: `parseInt` aceptaría «1043abc» como 1043.
  if (!/^\d{1,9}$/.test(crudo)) notFound();

  const orden = await leerOrdenDelPanel(Number.parseInt(crudo, 10));
  if (!orden) notFound();

  const direccion = orden.shippingAddress;
  const envio = formaDeEntrega(orden) === "envio" && direccion;

  return (
    <div className="flex flex-col gap-4">
      <div>
        {/* Al listado a secas, sin los filtros que traía: el botón atrás del
            navegador sí los conserva, y esto es la salida de emergencia. */}
        <Button asChild variant="tertiary" size="sm" className="-ml-3">
          <Link href="/admin/ordenes">
            <ChevronLeft aria-hidden />
            Órdenes
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title text-ink">Orden #{orden.numero}</h1>
          <EstadoDeLaOrden estado={orden.estado} />
          <OrigenDeLaOrden origen={orden.origen} />
        </div>

        {/* El atajo de RF-21. El teléfono del pedido es obligatorio en las
            tres vías de alta (RF-05), así que el botón siempre puede estar. */}
        <Button asChild variant="brand" size="sm">
          <a
            href={enlaceDeWhatsApp(
              orden.customerPhone,
              mensajeParaElComprador(orden.numero),
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconoWhatsApp className="size-4" />
            Escribirle por WhatsApp
          </a>
        </Button>
      </div>

      <p className="text-body-sm text-ink-secondary">
        Creada el {fechaConHora(orden.creadaEn)}
        {orden.finalizadaEn
          ? ` · finalizada el ${fechaConHora(orden.finalizadaEn)}`
          : orden.canceladaEn
            ? ` · cancelada el ${fechaConHora(orden.canceladaEn)}`
            : ""}
      </p>

      {orden.estado === "activa" ? (
        <p className="rounded-panel-card border border-dashed border-border bg-surface px-4 py-3 text-body-sm text-ink-secondary">
          Podés quitar productos o bajar cantidades desde la tabla, y lo que
          saques vuelve al stock enseguida. Finalizarla o cancelarla desde acá
          llega con la próxima tarea del panel.
        </p>
      ) : null}

      {/* Dos columnas en escritorio: los ítems mandan y ocupan el ancho, y
          los datos del comprador acompañan al costado. Apilados, la
          dirección quedaría tres pantallas abajo del pedido. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex flex-col gap-4">
          <Renglones orden={orden} />
          <HistorialDeLaOrden entradas={orden.historial} />
        </div>

        <div className="flex flex-col gap-4">
          <Ficha titulo="Comprador">
            <Dato titulo="A nombre de" valor={orden.customerName} />
            <Dato titulo="Teléfono" valor={orden.customerPhone} />
            <Dato
              titulo="Email"
              valor={orden.customerEmail}
              vacio="Sin email"
            />
            {/*
              La cuenta, cuando la hay, es OTRO dato que el nombre de arriba:
              el del pedido vale sólo para ese pedido (F6.1), y quien compró
              para un tercero puso los datos del tercero. Verlas juntas es lo
              que evita escribirle al que no era.
            */}
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

          <Ficha titulo={envio ? "Envío" : "Entrega"}>
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
            <Ficha titulo="Notas">
              <p className="text-body-sm whitespace-pre-line text-ink">
                {orden.notas}
              </p>
            </Ficha>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Los renglones con precio unitario y subtotal — RF-21.
 *
 * Todo sale del snapshot (RN-12): el producto pudo cambiar de nombre o de
 * precio, y esta orden tiene que seguir diciendo lo que se vendió. Por eso
 * tampoco hay enlace a la ficha del producto.
 */
function Renglones({ orden }: { orden: OrdenDelPanel }) {
  // RF-22: sólo las activas se editan. La regla la hace cumplir el dominio
  // con un `FOR UPDATE` (`editar.ts`); acá se decide qué se dibuja, que no es
  // lo mismo — un botón escondido no es una guardia.
  const editable = orden.estado === "activa";
  const esElUnico = orden.items.length === 1;

  /**
   * Una orden puede quedarse sin renglones, y sólo de una manera: se le quitó
   * el último (RF-22), lo que la cancela. Una tabla con la cabecera puesta y
   * nada debajo no explica eso (§8), y el historial de al lado sí — pero está
   * más abajo. Se dice acá.
   */
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
            <TableHead>Producto</TableHead>
            <TableHead className="w-32">Color</TableHead>
            <TableHead data-align="right" className="w-24">
              Cantidad
            </TableHead>
            <TableHead data-align="right" className="w-36">
              Precio
            </TableHead>
            <TableHead data-align="right" className="w-36">
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
                <span className="font-medium text-ink">{item.nombre}</span>{" "}
                <span className="text-ink-tertiary">{item.marca}</span>
              </TableCell>
              <TableCell className="text-ink-secondary">
                {item.color ?? "—"}
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
            <span className="text-caption text-ink-tertiary">
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

function Ficha({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4">
      <h2 className="text-body-sm font-medium text-ink">{titulo}</h2>
      <dl className="flex flex-col gap-2.5">{children}</dl>
    </section>
  );
}

/**
 * Un dato del comprador o de la entrega.
 *
 * Lo que falta **se dice**, no se esconde: un email en blanco y un email
 * ausente se ven igual si el renglón desaparece, y son dos cosas distintas
 * cuando hay que avisarle algo a alguien. Salvo que no haya nada que decir —
 * unas indicaciones vacías no son una ausencia, y ahí sí se omite.
 */
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
          valor ? "text-body-sm text-ink" : "text-body-sm text-ink-tertiary"
        }
      >
        {valor ?? vacio}
      </dd>
    </div>
  );
}
