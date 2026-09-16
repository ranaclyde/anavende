import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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
import {
  devolucionesDeLaOrden,
  devueltasPorRenglon,
  type Devolucion,
} from "@/modules/returns/queries";

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
 * **Las acciones viven acá, y cada estado tiene las suyas.** Mientras la orden
 * está activa se edita renglón por renglón en la tabla —quitar, bajar y subir
 * (F7.2 y F7.2a)—, se agrega un producto al pie de esa misma tabla, y se
 * finaliza o se cancela en la cabecera (F7.3). **Una vez finalizada lo único
 * que puede pasarle es una devolución** (RF-25, F7.5), y por eso el botón
 * aparece recién ahí: lo que todavía no se entregó no se devuelve, se edita o
 * se cancela. Sobre una cancelada no hay nada que hacer (RF-13), así que no
 * hay controles apagados: simplemente no están.
 */
export default async function DetalleDeLaOrden({ params }: Props) {
  const { numero: crudo } = await params;

  // Sólo dígitos: `parseInt` aceptaría «1043abc» como 1043.
  if (!/^\d{1,9}$/.test(crudo)) notFound();

  const numero = Number.parseInt(crudo, 10);

  // **En paralelo, y las devoluciones se piden siempre.** Esperar a la orden
  // para sacarle el `id` y recién entonces buscar sus devoluciones sería una
  // cascada en la pantalla que más se abre del panel; y preguntarlas sólo si
  // está finalizada obligaría a la misma espera. Una orden sin devoluciones
  // —que son casi todas— contesta con una lista vacía.
  const [orden, devoluciones] = await Promise.all([
    leerOrdenDelPanel(numero),
    devolucionesDeLaOrden(numero),
  ]);
  if (!orden) notFound();

  // Lo ya devuelto de cada renglón, contando sólo las devoluciones vigentes:
  // anular libera el cupo (RF-25). Es el mismo criterio que el tope del
  // dominio, calculado sobre lo que ya se leyó.
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
    // Un renglón devuelto del todo no se puede volver a devolver: ofrecerlo
    // sería ofrecer un error (RF-25).
    .filter((item) => item.cantidad > item.yaDevueltas);

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

        <div className="flex flex-wrap items-center gap-2">
          {/* El atajo de RF-21. El teléfono del pedido es obligatorio en las
              tres vías de alta (RF-05), así que el botón siempre puede estar.
              **Dejó de ser el de marca** cuando llegó «Finalizar» (F7.3): de
              esta pantalla se sale finalizando o cancelando, escribirle es el
              paso previo, y §6.3 admite un solo botón de marca por pantalla. */}
          <Button asChild variant="secondary" size="sm">
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

          {/* RF-25. Sólo sobre una finalizada, y sólo si queda algo por
              devolver: un diálogo que se abre para decir que no hay nada es
              el que sobra. */}
          {orden.estado === "finalizada" && paraDevolver.length > 0 ? (
            <DevolverDeLaOrden numero={orden.numero} items={paraDevolver} />
          ) : null}

          {/* RF-23. Sólo desde `activa`: es lo que dice `TRANSICIONES`, y de
              las otras dos no sale ninguna flecha. */}
          {orden.estado === "activa" ? (
            <ResolverLaOrden
              numero={orden.numero}
              // Sólo lo que los diálogos usan (§ rendimiento: lo que viaja al
              // cliente se serializa entero). Los precios están en la tabla y
              // no cambian con esto.
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
        </div>
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
          Podés ajustar el pedido desde la tabla: quitar, bajar o sumar
          cantidades y agregar productos. Lo que saques vuelve al stock
          enseguida y lo que sumes se reserva, si hay. Cuando la entregues,
          finalizala: ahí se descuenta el stock de verdad. Ni finalizarla ni
          cancelarla tienen vuelta atrás.
        </p>
      ) : null}

      {/* Dos columnas en escritorio: los ítems mandan y ocupan el ancho, y
          los datos del comprador acompañan al costado. Apilados, la
          dirección quedaría tres pantallas abajo del pedido. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex flex-col gap-4">
          <Renglones orden={orden} />
          <Devoluciones devoluciones={devoluciones} />
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

      {/* RF-22: agregar va con los renglones y no en la cabecera — es una
          operación sobre esta lista, y se lee al lado de lo que ya tiene. */}
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

/**
 * Las devoluciones de esta orden — RF-25. Tarea F7.5.
 *
 * **Va entre los renglones y el historial**, que es el lugar que le
 * corresponde por lo que cuenta: qué se vendió, qué volvió de eso, y recién
 * después quién movió la orden y cuándo. Sin esto, una orden con media
 * devolución registrada se leería como si se hubiera entregado entera.
 *
 * **Cuando no hay ninguna no se dibuja nada.** Una sección vacía titulada
 * «Devoluciones» en cada una de las órdenes del año es ruido: lo que no pasó
 * no ocupa lugar (§8).
 */
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
