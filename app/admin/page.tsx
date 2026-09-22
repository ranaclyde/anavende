import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { Button } from "@/components/ui/button";
import { mesEnCurso } from "@/lib/fechas";
import { formatMoney } from "@/lib/money";
import { comoVieneElMes, loQueHayParaHacer } from "@/modules/panel/tablero";
import { umbralDeStockBajo } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Panel" };

/**
 * Inicio del panel — FS RF-14 · DR §6.9. Tarea F7.8.
 *
 * **Dos bloques, dos preguntas, y ningún número repetido** (decisión tuya del
 * 2026-09-17). RF-14 pide cuatro indicadores y, desde tu pedido del
 * 2026-09-14, también «qué hay pendiente al entrar»; dos de los tres
 * pendientes son dos de los cuatro indicadores. Puestos como siete tarjetas,
 * la pantalla decía el mismo número dos veces y no contestaba ninguna de las
 * dos cosas. Así, arriba va lo que pide acción —con verbo y enlace— y abajo lo
 * que solo se mira.
 *
 * **Sin notificaciones**, como RF-14 pide: esto se ve al abrir el panel y no
 * persigue a nadie.
 *
 * **Cada número abre el listado que lo produjo.** El mes se recorta en la
 * consulta y el enlace viaja con esa misma fecha (`modules/panel/tablero.ts`),
 * así no puede pasar que el tablero diga 5 y el listado muestre 7.
 */
export default async function PanelInicio() {
  // El umbral hace falta ANTES de contar el stock, así que ése es el único
  // encadenado. Los dos bloques son independientes entre sí.
  const umbral = await umbralDeStockBajo();
  const [paraHacer, mes] = await Promise.all([
    loQueHayParaHacer(umbral),
    comoVieneElMes(),
  ]);

  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Panel"
        bajada="Lo que hay para hacer, y cómo viene el mes."
      />

      <ParaHacer datos={paraHacer} />
      <EsteMes datos={mes} />
    </div>
  );
}

/**
 * Lo que espera que alguien lo atienda.
 *
 * **Sin nada pendiente es una sola línea**, no tres renglones en cero: «no hay
 * nada» se dice una vez. Lo de antes —un bloque que aparecía sólo con bajas
 * pedidas— tenía el mismo criterio y se queda con él.
 *
 * **El orden es el de la urgencia y no el de las secciones del menú**: las
 * órdenes tienen a alguien esperando del otro lado, el stock es plata que se
 * deja de vender, y una baja pedida puede esperar a mañana sin que nadie se
 * enoje.
 */
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
            // El listado se abre en «Activas», que es su solapa de fábrica
            // (F7.1): por eso el enlace no lleva ningún parámetro.
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
            {/* El cero se nombra aparte porque es lo urgente de lo mismo:
                RF-20 los junta en una sola pregunta —«¿qué hay que
                comprar?»— y lo que ya no se puede vender no espera igual que
                lo que está por acabarse. **Cuando están todos en cero se dice
                una sola vez**: «23 para reponer, 23 sin stock» son dos
                maneras de decir lo mismo en el mismo renglón. */}
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

  // Sin `flex-wrap`: en el teléfono el «Ver» se caía a un renglón propio
  // cuando el texto era largo y a veces no, según cuánto midiera cada frase, y
  // la lista quedaba dispareja. Ahora el texto envuelve y el botón se queda al
  // lado. Lo encontró el repaso con Playwright.
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
 * Cómo viene el mes — los indicadores «fríos» de RF-14.
 *
 * **Nombra el mes.** El 1° a la mañana estos números caen a cero de golpe, y
 * sin decir cuál se está contando eso se lee como que algo se rompió.
 */
function EsteMes({
  datos,
}: {
  datos: Awaited<ReturnType<typeof comoVieneElMes>>;
}) {
  return (
    <TarjetaDeSeccion
      id="este-mes"
      titulo={
        <>
          Este mes{" "}
          <span className="text-body-sm font-normal text-ink-secondary">
            ({mesEnCurso()})
          </span>
        </>
      }
    >
      {/* Una lista y no un `<dl>`: los tres son enlaces, y un `<a>` no puede
          colgar directo de un `<dl>` —sólo `dt`, `dd` y `div`—. */}
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
    </TarjetaDeSeccion>
  );
}

/**
 * Un número con su nombre, enlazado al listado que lo produce (RF-14).
 *
 * **El enlace envuelve todo el bloque** y no un «ver» al costado: acá no hay
 * nada más que tocar, y un rectángulo entero es un blanco más grande que tres
 * palabras —que es lo que más se agradece desde el teléfono—.
 */
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
