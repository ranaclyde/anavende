import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TiendaEnElInicio } from "@/components/admin/configuracion/mantenimiento";
import { MarcaDeAguaEnElInicio } from "@/components/admin/configuracion/marca-de-agua";
import { GraficoDeVentas } from "@/components/admin/reportes/graficos";
import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { Button } from "@/components/ui/button";
import { mesEnCurso } from "@/lib/fechas";
import { formatMoney, isZero } from "@/lib/money";
import { laMarcaDeAguaEstaActiva } from "@/modules/marca-de-agua/queries";
import { comoVieneElMes, loQueHayParaHacer } from "@/modules/panel/tablero";
import { elMesEntero, hoyEnLaZona } from "@/modules/reports/periodo";
import {
  ventasEnElTiempo,
  type PuntoDeVentas,
} from "@/modules/reports/queries";
import {
  elModoMantenimiento,
  umbralDeStockBajo,
} from "@/modules/settings/queries";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Panel" };

/**
 * Inicio del panel (RF-14, DR §6.9). Cada número enlaza al listado que lo
 * produjo con la misma fecha de corte (`modules/panel/tablero.ts`), así el
 * tablero y el listado no pueden decir cosas distintas.
 */
export default async function PanelInicio() {
  await exigirAdmin();

  // Todo adentro del `Promise.all`: una promesa que arranca afuera y espera
  // detrás de otro `await` queda sin manejar si ese otro falla primero (pasa
  // en el build, que pinta esta página sin base). El modo mantenimiento se lee
  // de la base, no de la memoria del proxy, para mostrar lo recién guardado.
  const hoy = hoyEnLaZona();
  const [paraHacer, mes, mantenimiento, porDia, marcaDeAgua] =
    await Promise.all([
      umbralDeStockBajo().then(loQueHayParaHacer),
      comoVieneElMes(),
      elModoMantenimiento(),
      ventasEnElTiempo(elMesEntero(hoy), "dia"),
      laMarcaDeAguaEstaActiva(),
    ]);

  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Panel"
        bajada="Lo que hay para hacer, y cómo viene el mes."
      />

      <TiendaEnElInicio activo={mantenimiento} />
      <MarcaDeAguaEnElInicio activa={marcaDeAgua} />
      <ParaHacer datos={paraHacer} />
      <EsteMes datos={mes} porDia={porDia} hoy={hoy} />
    </div>
  );
}

/** Ordenado por urgencia, no por el menú: órdenes, stock y bajas pedidas. */
function ParaHacer({
  datos,
}: {
  datos: Awaited<ReturnType<typeof loQueHayParaHacer>>;
}) {
  const { ordenesActivas, paraReponer, sinStock, bajasPedidas } = datos;
  const hayAlgo = ordenesActivas + paraReponer + bajasPedidas > 0;

  return (
    <TarjetaDeSeccion id="para-hacer" titulo="Para hacer">
      {hayAlgo ? (
        <ul className="flex flex-col divide-y divide-border">
          <Pendiente
            cuantos={ordenesActivas}
            // Sin parámetros: el listado ya abre en «Activas».
            href="/admin/ordenes"
            accion="Ver las órdenes"
          >
            {ordenesActivas === 1
              ? "1 orden activa esperando que la prepares"
              : `${ordenesActivas} órdenes activas esperando que las prepares`}
          </Pendiente>

          <Pendiente
            cuantos={paraReponer}
            href="/admin/productos?estado=activos&stock=reponer"
            accion="Ver los productos"
          >
            {/* Sin stock se nombra aparte (RF-20); si todos están en cero, se
                dice una sola vez. */}
            {sinStock === paraReponer ? (
              <span className="text-danger">
                {paraReponer === 1
                  ? "1 producto sin stock"
                  : `${paraReponer} productos sin stock`}
              </span>
            ) : (
              <>
                {paraReponer === 1
                  ? "1 producto para reponer"
                  : `${paraReponer} productos para reponer`}
                {sinStock > 0 ? (
                  <span className="text-danger">
                    {sinStock === 1
                      ? ", 1 sin stock"
                      : `, ${sinStock} sin stock`}
                  </span>
                ) : null}
              </>
            )}
          </Pendiente>

          <Pendiente
            cuantos={bajasPedidas}
            href="/admin/usuarios?estado=baja-pedida"
            accion="Ver en Usuarios"
          >
            {bajasPedidas === 1
              ? "1 comprador pidió la baja de su cuenta"
              : `${bajasPedidas} compradores pidieron la baja de su cuenta`}
          </Pendiente>
        </ul>
      ) : (
        <p className="text-body-sm text-ink-secondary">
          No hay nada esperando: ninguna orden por preparar, nada para reponer y
          ninguna baja pedida.
        </p>
      )}
    </TarjetaDeSeccion>
  );
}

/** Un renglón, y sólo si hay algo que contar: un cero no es un pendiente. */
function Pendiente({
  cuantos,
  href,
  accion,
  children,
}: {
  cuantos: number;
  href: string;
  /** Qué se abre. Se lee entero con lectores de pantalla, y a la vista es «Ver». */
  accion: string;
  children: React.ReactNode;
}) {
  if (cuantos === 0) return null;

  // Sin `flex-wrap`: envuelve el texto y el «Ver» se queda al lado, para que
  // la lista no quede dispareja en el teléfono.
  return (
    <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <p className="min-w-0 flex-1 text-body-sm text-ink">{children}</p>
      <Button asChild variant="tertiary" size="sm" className="-mr-2 shrink-0">
        <Link href={href}>
          <span className="sr-only">{accion}</span>
          <span aria-hidden>Ver</span>
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </li>
  );
}

/**
 * Nombra el mes: el 1° los números caen a cero, y sin decir cuál se cuenta
 * parece que algo se rompió.
 */
function EsteMes({
  datos,
  porDia,
  hoy,
}: {
  datos: Awaited<ReturnType<typeof comoVieneElMes>>;
  porDia: PuntoDeVentas[];
  hoy: string;
}) {
  const huboVentas = porDia.some((p) => !isZero(p.vendido));

  return (
    <TarjetaDeSeccion
      id="este-mes"
      acciones={
        <Button asChild variant="tertiary" size="sm" className="-mr-2">
          <Link href="/admin/reportes">
            Ver reportes
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
      titulo={
        <>
          Este mes{" "}
          <span className="text-body-sm font-normal text-ink-secondary">
            ({mesEnCurso()})
          </span>
        </>
      }
    >
      {/* Una lista y no un `<dl>`: un `<a>` no puede colgar de un `<dl>`. */}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Numero
          titulo="Vendido"
          valor={formatMoney(datos.vendido)}
          href={`/admin/ordenes?estado=finalizadas&desde=${datos.desde}`}
          ayuda="Órdenes finalizadas, menos las devoluciones del mes"
        />
        <Numero
          titulo={
            datos.ordenes === 1 ? "Orden finalizada" : "Órdenes finalizadas"
          }
          valor={String(datos.ordenes)}
          href={`/admin/ordenes?estado=finalizadas&desde=${datos.desde}`}
          ayuda="Entregadas y cobradas"
        />
        <Numero
          titulo="Productos activos"
          valor={String(datos.productosActivos)}
          href="/admin/productos?estado=activos"
          ayuda="Lo que hoy se puede comprar en la tienda"
        />
      </ul>

      {/* Sin una sola venta, treinta columnas en cero no dicen nada que esta
          frase no diga mejor. */}
      {huboVentas ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-body-sm font-medium text-ink">Vendido por día</h3>
          <GraficoDeVentas
            puntos={porDia}
            agrupado="dia"
            hasta={hoy}
            etiqueta={`Lo vendido cada día de ${mesEnCurso()}`}
            className="aspect-auto h-40 w-full"
          />
        </div>
      ) : (
        <p className="text-body-sm text-ink-secondary">
          Todavía no hubo ventas este mes: el gráfico por día aparece con la
          primera orden finalizada.
        </p>
      )}
    </TarjetaDeSeccion>
  );
}

/** El enlace envuelve todo el bloque: un blanco más grande en el teléfono. */
function Numero({
  titulo,
  valor,
  href,
  ayuda,
}: {
  titulo: string;
  valor: string;
  href: string;
  ayuda: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-0.5 rounded-panel-card border border-border p-3 transition-colors duration-150 hover:bg-surface-sunken"
      >
        <span className="text-caption text-ink-secondary">{titulo}</span>
        <span className="text-body-lg font-medium text-ink tabular-nums">
          {valor}
        </span>
        <span className="text-caption text-ink-secondary">{ayuda}</span>
      </Link>
    </li>
  );
}
