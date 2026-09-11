import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ControlesDelItem,
  VaciarCarrito,
} from "@/components/shop/carrito/acciones";
import { Precio } from "@/components/shop/precio";
import { Button } from "@/components/ui/button";
import { formatMoney, type Money } from "@/lib/money";
import { getIdentity, getSession } from "@/lib/session";
import { leerCarrito, type ItemDelCarrito } from "@/modules/cart/queries";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";
import { urlDeImagen } from "@/modules/media/subir";

export const metadata: Metadata = { title: "Tu carrito" };

/**
 * El carrito — F5.5, RF-08, DESIGN-REFERENCE §7.4.
 *
 * Lista a la izquierda y resumen a la derecha, que baja al final en el
 * teléfono. Nace sobre el lineamiento del canvas (F3.8) en vez de ser
 * rediseñado después.
 *
 * **Lo que todavía no hace, y es de otras tareas:** los avisos de precio
 * cambiado, stock reducido y producto desactivado son F5.6; confirmar el
 * pedido es F6.1; «Completá tu setup» es RF-32, de F8.
 */
export default async function PaginaDelCarrito() {
  // El proxy ya manda a ingresar a quien no tiene cookie; esto es la
  // guardia de verdad (§6.1), y además distingue a quien tiene identidad
  // pero todavía no completó el perfil (§13.4).
  const sesion = await getSession();

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/carrito");
  }

  const carrito = await leerCarrito(sesion.profile.id);

  // El encabezado es el mismo con y sin productos, y es el del catálogo
  // (título y bajada): la pantalla vacía no puede ser otra pantalla.
  return (
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 pb-7">
        <h1 className="text-title text-ink">Tu carrito</h1>
        {/*
          La bajada dice lo que el comprador no puede adivinar: que acá no se
          paga (RN-08). Sin eso, un carrito con total se lee como el paso
          previo a una tarjeta.
        */}
        <p className="text-body text-ink-secondary">
          Armá tu pedido y lo coordinamos por WhatsApp. No se cobra nada acá.
        </p>
      </header>

      {carrito.items.length === 0 ? (
        <CarritoVacio />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
          <ul className="flex flex-col gap-3">
            {carrito.items.map((item) => (
              <Renglon key={item.variantId} item={item} />
            ))}
          </ul>

          <Resumen
            total={carrito.total}
            unidades={carrito.unidades}
            renglones={carrito.items.length}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Un renglón: miniatura de 80px, nombre, color, precio unitario, cantidad,
 * subtotal y «Quitar» (§7.4).
 */
function Renglon({ item }: { item: ItemDelCarrito }) {
  const ruta = item.colorSlug
    ? `/productos/${item.slug}?color=${item.colorSlug}`
    : `/productos/${item.slug}`;

  // §9: producto, marca y color.
  const alt =
    `${item.nombre} ${item.marca}` +
    (item.colorNombre ? `, ${item.colorNombre.toLowerCase()}` : "");

  // El selector no ofrece más de lo que hay, pero tampoco puede quedar por
  // DEBAJO de lo que ya está en el carrito: con el stock caído a 1 y 4 en el
  // carrito, un tope de 1 dibujaría un 4 imposible de mover. Bajar se puede
  // siempre (`cambiarCantidad`); ajustar sola la cantidad es F5.6.
  const maximo = Math.max(
    item.cantidad,
    Math.min(Math.max(0, item.disponible), TOPE_POR_ITEM),
  );

  return (
    <li className="flex gap-4 rounded-card bg-surface p-3 shadow-md sm:p-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-image bg-surface-sunken">
        {item.imagenKey ? (
          <Image
            src={urlDeImagen(item.imagenKey, "thumb")}
            alt={alt}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
          {item.marca}
        </p>
        <h2 className="text-body-sm font-medium text-ink">
          <Link
            href={ruta}
            className="rounded-pill underline-offset-4 hover:underline"
          >
            {item.nombre}
          </Link>
        </h2>
        {item.colorNombre ? (
          <p className="text-caption text-ink-secondary">
            Color: {item.colorNombre}
          </p>
        ) : null}

        <div className="flex items-end gap-1.5">
          <Precio
            precio={item.precio}
            descuento={item.descuento}
            precioFinal={item.precioFinal}
          />
          <span className="text-caption text-ink-tertiary">c/u</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <ControlesDelItem
            variantId={item.variantId}
            nombre={item.nombre}
            cantidad={item.cantidad}
            maximo={maximo}
          />
          <p className="text-body font-medium text-ink tabular-nums">
            <span className="sr-only">Subtotal: </span>
            {formatMoney(item.subtotal)}
          </p>
        </div>
      </div>
    </li>
  );
}

/**
 * El resumen, fijo al costado en pantallas anchas.
 *
 * **«Continuar con el pedido» va apagado**, con el motivo solo para lectores
 * de pantalla: es el mismo criterio que tuvo «Agregá al carrito» en la ficha
 * mientras no existía el carrito (decisión del 2026-09-08). Se enciende con
 * F6.1.
 *
 * La leyenda de entrega es RN-10 y la pide RF-08: el envío no se cobra en la
 * web, y quien llega al total tiene que saber que ese número no va a crecer
 * en el checkout por un costo que no vio.
 */
function Resumen({
  total,
  unidades,
  renglones,
}: {
  total: Money;
  unidades: number;
  renglones: number;
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
        <Button
          size="lg"
          variant="brand"
          disabled
          aria-describedby="pedido-pendiente"
          className="w-full"
        >
          Continuar con el pedido
        </Button>
        <p id="pedido-pendiente" className="sr-only">
          Confirmar el pedido todavía no está disponible.
        </p>

        <VaciarCarrito renglones={renglones} />
      </div>
    </section>
  );
}

/**
 * §8: qué falta y la acción para resolverlo. Nunca un espacio en blanco.
 *
 * Es el MISMO recuadro que el estado vacío del catálogo (`Vacio`, en
 * `app/(shop)/productos/page.tsx`), clase por clase: la tienda tiene una sola
 * forma de decir «no hay nada acá». Está copiado y no compartido porque
 * sacarlo a un componente toca el catálogo, y eso quedó para la revisión de
 * consistencia anotada en PROGRESO.
 */
function CarritoVacio() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-20 text-center shadow-md">
      <h2 className="text-heading text-ink">Todavía no agregaste nada</h2>
      <p className="max-w-prose text-body text-ink-secondary">
        Mirá el catálogo y sumá lo que necesites.
      </p>
      <Button asChild variant="brand" size="lg" className="mt-2">
        <Link href="/productos">Ver productos</Link>
      </Button>
    </div>
  );
}
