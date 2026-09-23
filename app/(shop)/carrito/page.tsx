import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ControlesDelItem,
  VaciarCarrito,
} from "@/components/shop/carrito/acciones";
import { Avisos } from "@/components/shop/carrito/avisos";
import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";
import { Precio } from "@/components/shop/precio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, type Money } from "@/lib/money";
import { FUERA_DEL_INDICE } from "@/lib/seo";
import { getIdentity, getSession } from "@/lib/session";
import { leerCarrito, type ItemDelCarrito } from "@/modules/cart/queries";
import { revisarCarrito } from "@/modules/cart/revision";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";
import { urlDeImagen } from "@/modules/media/subir";

export const metadata: Metadata = {
  title: "Tu carrito",
  // F3.9: es de una persona y de un momento, no del sitio.
  robots: FUERA_DEL_INDICE,
};

/**
 * El carrito — F5.5, F5.6, RF-08, DESIGN-REFERENCE §7.4.
 *
 * Lista a la izquierda y resumen a la derecha, que baja al final en el
 * teléfono. Nace sobre el lineamiento del canvas (F3.8) en vez de ser
 * rediseñado después.
 *
 * **Al abrirlo se revisa contra el catálogo** (F5.6): lo que cambió se avisa
 * arriba, una vez; lo que no tiene stock queda marcado y fuera del total; y
 * lo que se dejó de vender queda apartado en «Ya no disponible» hasta que el
 * comprador lo quite.
 *
 * «Continuar con el pedido» lleva al checkout (F6.1). **Lo que todavía no
 * hace, y es de otra tarea:** «Completá tu setup» es RF-32, de F8.
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

  // La revisión primero y la lectura DESPUÉS, no en paralelo: lo que se
  // muestra tiene que ser el carrito ya ajustado, no el de antes de revisar.
  const avisos = await revisarCarrito(sesion.profile.id);
  const carrito = await leerCarrito(sesion.profile.id);

  const enElPedido: ItemDelCarrito[] = [];
  const apartados: ItemDelCarrito[] = [];
  for (const item of carrito.items) {
    (item.estado === "no-disponible" ? apartados : enElPedido).push(item);
  }

  // Se sigue al checkout con todo en regla. Lo que no tiene stock o no se
  // vende no se puede reservar, y la orden es todo o nada (§8.3 regla 1):
  // confirmar con eso adentro fallaría siempre.
  const continuar: Continuar =
    sesion.profile.closureRequestedAt != null
      ? "pausa"
      : carrito.items.length > 0 &&
          carrito.items.every((i) => i.estado === "vigente")
        ? "si"
        : "quitar";

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
    </div>
  );
}

/**
 * Un renglón: miniatura de 80px, nombre, color, precio unitario, cantidad,
 * subtotal y «Quitar» (§7.4).
 *
 * Los tres estados (F5.6) comparten el dibujo y cambian lo que ofrecen:
 * vigente es el renglón completo; sin stock pierde la cantidad y el
 * subtotal, porque no hay nada que elegir ni que sumar; y no disponible
 * pierde además el enlace y el precio: la ficha ya no existe para el
 * público, y un precio de algo que no se vende no informa nada.
 */
function Renglon({ item }: { item: ItemDelCarrito }) {
  const vigente = item.estado === "vigente";
  const seVende = item.estado !== "no-disponible";

  const ruta = item.colorSlug
    ? `/productos/${item.slug}?color=${item.colorSlug}`
    : `/productos/${item.slug}`;

  // §9: producto, marca y color.
  const alt =
    `${item.nombre} ${item.marca}` +
    (item.colorNombre ? `, ${item.colorNombre.toLowerCase()}` : "");

  // El selector no ofrece más de lo que hay, pero tampoco puede quedar por
  // DEBAJO de lo que ya está en el carrito. Después de la revisión no
  // debería pasar, pero el stock puede caer entre la revisión y el clic, y
  // un tope por debajo dibujaría un número imposible de mover.
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
            className={seVende ? "object-cover" : "object-cover opacity-50 grayscale"}
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
  );
}

/**
 * Lo que se dejó de vender (RF-08, variante B del 2026-09-12). No se borra
 * solo: queda a la vista, fuera del total, hasta que el comprador lo quite.
 * Ese renglón ES el aviso persistente — si no lo ve hoy, lo ve la próxima
 * vez que abra el carrito.
 */
function YaNoDisponible({ items }: { items: ItemDelCarrito[] }) {
  return (
    <section aria-labelledby="no-disponible-titulo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="no-disponible-titulo" className="text-body-lg font-medium text-ink">
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

/** Si se puede seguir al checkout, y si no, por qué. */
type Continuar = "si" | "pausa" | "quitar";

/**
 * El resumen, fijo al costado en pantallas anchas.
 *
 * **«Continuar con el pedido» lleva al checkout** (F6.1). Apagado dice por
 * qué, como todo control apagado (§8): con la baja pedida apunta al aviso de
 * arriba de la tienda; con algo sin stock o que ya no se vende, lo dice abajo
 * del botón.
 *
 * La leyenda de entrega es RN-10 y la pide RF-08: el envío no se cobra en la
 * web, y quien llega al total tiene que saber que ese número no va a crecer
 * en el checkout por un costo que no vio.
 */
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
              <p id="continuar-motivo" className="text-body-sm text-ink-secondary">
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
