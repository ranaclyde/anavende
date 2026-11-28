import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, ViewTransition } from "react";

import {
  ControlesDelItem,
  VaciarCarrito,
} from "@/components/shop/carrito/acciones";
import { Avisos } from "@/components/shop/carrito/avisos";
import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";
import { Precio } from "@/components/shop/precio";
import {
  CompletaTuSetup,
  EsqueletoDeRecomendados,
} from "@/components/shop/recomendados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, type Money } from "@/lib/money";
import { NO_INDEX } from "@/lib/seo";
import { getIdentity, getSession } from "@/lib/session";
import { leerCarrito, type ItemDelCarrito } from "@/modules/cart/queries";
import { revisarCarrito } from "@/modules/cart/revision";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";
import { urlDeImagen } from "@/modules/media/subir";

export const metadata: Metadata = {
  title: "Tu carrito",
  robots: NO_INDEX,
};

export default async function PaginaDelCarrito() {
  // El proxy solo mira la cookie: la guardia de verdad es esta.
  const sesion = await getSession();

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/carrito");
  }

  // La revisión primero y la lectura después, no en paralelo: lo que se
  // muestra tiene que ser el carrito ya ajustado.
  const avisos = await revisarCarrito(sesion.profile.id);
  const carrito = await leerCarrito(sesion.profile.id);

  const enElPedido: ItemDelCarrito[] = [];
  const apartados: ItemDelCarrito[] = [];
  for (const item of carrito.items) {
    (item.estado === "no-disponible" ? apartados : enElPedido).push(item);
  }

  // La orden es todo o nada (TS §8.3): con algo sin stock o que no se vende
  // adentro, confirmar fallaría siempre.
  const continuar: Continuar =
    sesion.profile.closureRequestedAt != null
      ? "pausa"
      : carrito.items.length > 0 &&
          carrito.items.every((i) => i.estado === "vigente")
        ? "si"
        : "quitar";

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 pb-7">
        <h1 className="text-title text-ink">Tu carrito</h1>
        {/* Sin esto, un carrito con total se lee como el paso previo a una tarjeta. */}
        <p className="text-body text-ink-secondary">
          Armá tu pedido y lo coordinamos por WhatsApp. No se cobra nada acá.
        </p>
      </header>

      {carrito.items.length === 0 ? (
        <CarritoVacio />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-6">
            {avisos.length > 0 ? <Avisos avisos={avisos} /> : null}

            {enElPedido.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {enElPedido.map((item) => (
                  <Renglon key={item.variantId} item={item} />
                ))}
              </ul>
            ) : null}

            {apartados.length > 0 ? <YaNoDisponible items={apartados} /> : null}
          </div>

          <Resumen
            total={carrito.total}
            unidades={carrito.unidades}
            renglones={carrito.items.length}
            continuar={continuar}
          />
        </div>
      )}

      {/* Con el carrito vacío no hay nada que completar. */}
      {carrito.items.length > 0 ? (
        <Suspense fallback={<EsqueletoDeRecomendados bloques={1} />}>
          <CompletaTuSetup
            variantes={carrito.items.map((i) => i.variantId)}
            userId={sesion.profile.id}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

/**
 * `<ViewTransition>` anima la salida al quitarlo (`globals.css`, `.renglon`):
 * lo dispara la acción, que refresca la página dentro de una transición.
 */
function Renglon({ item }: { item: ItemDelCarrito }) {
  const vigente = item.estado === "vigente";
  const seVende = item.estado !== "no-disponible";

  const ruta = item.colorSlug
    ? `/productos/${item.slug}?color=${item.colorSlug}`
    : `/productos/${item.slug}`;

  const alt =
    `${item.nombre} ${item.marca}` +
    (item.colorNombre ? `, ${item.colorNombre.toLowerCase()}` : "");

  // Nunca por debajo de lo que ya está en el carrito: el stock puede caer
  // entre la revisión y el clic, y el número quedaría imposible de mover.
  const maximo = Math.max(
    item.cantidad,
    Math.min(Math.max(0, item.disponible), TOPE_POR_ITEM),
  );

  return (
    <ViewTransition default="none" update="renglon" exit="renglon-sale">
      <li className="flex gap-4 rounded-card bg-surface p-3 shadow-md sm:p-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-image bg-surface-sunken">
          {item.imagenKey ? (
            <Image
              src={urlDeImagen(item.imagenKey, "thumb")}
              alt={alt}
              fill
              sizes="80px"
              className={
                seVende ? "object-cover" : "object-cover opacity-50 grayscale"
              }
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
            {item.marca}
          </p>
          <h3 className="text-body-sm font-medium text-ink">
            {seVende ? (
              <Link
                href={ruta}
                className="rounded-pill underline-offset-4 hover:underline"
              >
                {item.nombre}
              </Link>
            ) : (
              item.nombre
            )}
          </h3>
          {item.colorNombre ? (
            <p className="text-caption text-ink-secondary">
              Color: {item.colorNombre}
            </p>
          ) : null}

          {seVende ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="flex items-end gap-1.5">
                <Precio
                  precio={item.precio}
                  descuento={item.descuento}
                  precioFinal={item.precioFinal}
                />
                <span className="text-caption text-ink-secondary">c/u</span>
              </div>
              {vigente ? null : <Badge tone="danger">Sin stock</Badge>}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <ControlesDelItem
              variantId={item.variantId}
              nombre={item.nombre}
              cantidad={item.cantidad}
              maximo={maximo}
              soloQuitar={!vigente}
            />
            {vigente ? (
              <p className="text-body font-medium text-ink tabular-nums">
                <span className="sr-only">Subtotal: </span>
                {formatMoney(item.subtotal)}
              </p>
            ) : (
              <p className="text-body-sm text-ink-secondary">
                {seVende ? "No suma al total" : "Ya no está a la venta"}
              </p>
            )}
          </div>
        </div>
      </li>
    </ViewTransition>
  );
}

/** No se borra solo: este renglón es el aviso persistente (RF-08). */
function YaNoDisponible({ items }: { items: ItemDelCarrito[] }) {
  return (
    <section
      aria-labelledby="no-disponible-titulo"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="no-disponible-titulo"
          className="text-body-lg font-medium text-ink"
        >
          Ya no disponible
        </h2>
        <p className="text-body-sm text-ink-secondary">
          {items.length === 1
            ? "Este producto se dejó de vender, así que no suma al total. Quitalo cuando quieras."
            : "Estos productos se dejaron de vender, así que no suman al total. Quitalos cuando quieras."}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <Renglon key={item.variantId} item={item} />
        ))}
      </ul>
    </section>
  );
}

type Continuar = "si" | "pausa" | "quitar";

function Resumen({
  total,
  unidades,
  renglones,
  continuar,
}: {
  total: Money;
  unidades: number;
  renglones: number;
  continuar: Continuar;
}) {
  return (
    <section
      aria-labelledby="resumen-titulo"
      className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-md lg:sticky lg:top-18"
    >
      <h2 id="resumen-titulo" className="text-body-lg font-medium text-ink">
        Resumen
      </h2>

      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
        <p className="text-body text-ink">
          Total{" "}
          <span className="text-body-sm text-ink-secondary">
            ({unidades} {unidades === 1 ? "unidad" : "unidades"})
          </span>
        </p>
        <p className="text-heading font-medium text-ink tabular-nums">
          {formatMoney(total)}
        </p>
      </div>

      <p className="text-caption text-ink-secondary">
        El envío no se cobra acá. Entregamos en Viedma, Carmen de Patagones y
        alrededores, o pasás a retirarlo: lo coordinamos por WhatsApp.
      </p>

      <div className="flex flex-col gap-2">
        {continuar === "si" ? (
          <Button asChild size="lg" variant="brand" className="w-full">
            <Link href="/checkout">Continuar con el pedido</Link>
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant="brand"
              disabled
              aria-describedby={
                continuar === "pausa" ? ID_AVISO_DE_PAUSA : "continuar-motivo"
              }
              className="w-full"
            >
              Continuar con el pedido
            </Button>
            {continuar === "quitar" ? (
              <p
                id="continuar-motivo"
                className="text-body-sm text-ink-secondary"
              >
                Para continuar, quitá lo que no tiene stock o ya no está a la
                venta.
              </p>
            ) : null}
          </>
        )}

        <VaciarCarrito renglones={renglones} />
      </div>
    </section>
  );
}

/**
 * Copia, clase por clase, de `Vacio` en `vista-del-catalogo.tsx`: si cambia
 * uno, cambia el otro.
 */
function CarritoVacio() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-20 text-center shadow-md">
      <h2 className="text-heading text-ink">Todavía no agregaste nada</h2>
      <p className="max-w-prose text-body text-ink-secondary">
        Mirá el catálogo y sumá lo que necesites.
      </p>
      <Button asChild variant="brand" size="lg" className="mt-2">
        <Link href="/productos">Explorar el catálogo</Link>
      </Button>
    </div>
  );
}
