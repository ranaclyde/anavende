import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AyudaGuiada, type PasoDeAyuda } from "@/components/ui/ayuda-guiada";
import { CancelarLaOrden } from "@/components/shop/compras/cancelar";
import { EstadoDeLaOrden } from "@/components/shop/compras/estado";
import { RenglonDelPedido } from "@/components/shop/compras/renglon";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { formatMoney } from "@/lib/money";
import { getIdentity, getSession } from "@/lib/session";
import { enlaceDeWhatsApp, mensajeDeOrden } from "@/lib/whatsapp";
import { formaDeEntrega } from "@/modules/orders/entrega";
import { leerOrdenDelComprador } from "@/modules/orders/queries";
import { numeroDeWhatsApp } from "@/modules/settings/queries";

type Props = { params: Promise<{ numero: string }> };

/**
 * La guía del detalle (F6.6, RF-36), para un pedido en preparación: cómo
 * sigue y dónde se cancela. El estado no se explica: la frase de abajo de la
 * etiqueta ya lo dice. Sin número de WhatsApp configurado el botón no
 * existe, y ese paso se saltea.
 */
const PASOS_DEL_DETALLE: PasoDeAyuda[] = [
  {
    elemento: "seguir-whatsapp",
    titulo: "Seguimos por WhatsApp",
    texto:
      "Escribinos desde acá: el mensaje ya lleva tu pedido, así no tenés que explicar nada.",
    opcional: true,
  },
  {
    elemento: "cancelar-pedido",
    titulo: "¿Cambiaste de idea?",
    texto:
      "Mientras esté en preparación lo podés cancelar, sin dar explicaciones. No se te cobra nada.",
  },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { numero } = await params;
  return { title: `Pedido #${numero}` };
}

/**
 * El detalle de una compra — FS RF-07, RF-23, RF-34 · TS §13.8. Tarea F6.5.
 *
 * **No es la pantalla de confirmación.** `/orden/[numero]` es el momento de
 * haber comprado y se lee una vez: felicita, dice que el stock quedó guardado
 * y empuja a coordinar. Esta es el registro, y se vuelve a ella semanas
 * después para otra cosa — ver en qué anda, releer qué se pidió, arrepentirse.
 * Comparten los datos y no el tono, y por eso son dos páginas: hacer una sola
 * con un `if` la habría dejado a medio camino de las dos.
 *
 * **Cancelar está acá, a la vista.** RF-34 dejó escrito que para quien tiene
 * sesión, cancelar su orden `activa` *es* el derecho de arrepentimiento, y
 * RF-23 que su visibilidad es parte del requisito: no va detrás de un menú.
 *
 * Una orden ajena es un 404, igual que una que no existe (§13.8).
 */
export default async function DetalleDeLaCompra({ params }: Props) {
  const [{ numero: crudo }, sesion] = await Promise.all([params, getSession()]);

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect(
      `/ingresar?volver=${encodeURIComponent(`/mi-cuenta/compras/${crudo}`)}`,
    );
  }

  // Solo dígitos: `parseInt` aceptaría «1043abc» como 1043.
  if (!/^\d{1,9}$/.test(crudo)) notFound();
  const numero = Number.parseInt(crudo, 10);

  const [orden, whatsapp] = await Promise.all([
    leerOrdenDelComprador(sesion.profile.id, numero),
    numeroDeWhatsApp(),
  ]);
  if (!orden) notFound();

  const direccion = orden.shippingAddress;
  const total = formatMoney(orden.total);
  const activa = orden.estado === "activa";

  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="tertiary" size="sm" className="-ml-3">
          <Link href="/mi-cuenta/compras">
            <ChevronLeft aria-hidden />
            Mis compras
          </Link>
        </Button>
        {/* Solo en preparación: es cuando existen las dos acciones. */}
        {activa ? (
          <AyudaGuiada
            id="detalle-compra"
            pasos={PASOS_DEL_DETALLE}
            className="-mr-2"
          />
        ) : null}
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo" className="text-heading text-ink">
          Pedido #{orden.numero}
        </h2>
        <EstadoDeLaOrden estado={orden.estado} />
      </header>

      {/*
        Qué significa ese estado para quien mira, que la etiqueta sola no dice.
        Una cancelada explica además que el stock volvió: si no, queda la duda
        de si el pedido sigue reservado en algún lado.
      */}
      <div className="flex flex-col gap-1">
        <p className="text-body text-ink-secondary">
          {orden.estado === "activa"
            ? "Guardamos el stock hasta coordinar el pago y la entrega."
            : orden.estado === "finalizada"
              ? "Este pedido ya se entregó."
              : orden.cancelacion?.porLaTienda
                ? "Cancelamos este pedido y liberamos el stock. No se te cobró nada."
                : "Cancelaste este pedido y liberamos el stock. No se cobró nada."}
        </p>

        {/*
          El motivo que escribió la vendedora, cuando lo escribió — RF-23 lo
          deja opcional. **Se muestra acá y no sólo en el panel** (decisión
          del 2026-09-16): a quien le cancelaron un pedido, «por qué» es la
          única pregunta que le queda, y tenerla contestada le ahorra
          escribir. El propio arrepentimiento no lleva motivo, así que esto
          aparece únicamente cuando canceló la tienda.
        */}
        {orden.cancelacion?.motivo ? (
          <p className="text-body-sm text-ink-secondary">
            Motivo: {orden.cancelacion.motivo}
          </p>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-4 rounded-card bg-surface p-5 shadow-md">
        <ul className="flex flex-col gap-3">
          {orden.items.map((item) => (
            <RenglonDelPedido key={item.id} item={item} />
          ))}
        </ul>

        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
          <p className="text-body text-ink">
            Total{" "}
            <span className="text-body-sm text-ink-secondary">
              ({orden.unidades} {orden.unidades === 1 ? "unidad" : "unidades"})
            </span>
          </p>
          <p className="text-heading font-medium text-ink tabular-nums">
            {total}
          </p>
        </div>

        <dl className="flex flex-col gap-3 border-t border-border pt-4">
          <Dato titulo="A nombre de" valor={orden.customerName} />
          <Dato
            titulo="Entrega"
            valor={
              formaDeEntrega(orden) === "envio" && direccion
                ? `Envío a ${direccion.street} ${direccion.number}${direccion.apartment ? `, ${direccion.apartment}` : ""}, ${direccion.city}, ${direccion.province}`
                : "Lo retirás en el punto de entrega"
            }
          />
        </dl>
      </div>

      {/*
        Las dos acciones de una orden abierta, y solo mientras esté abierta:
        retomar la conversación (RF-07) y arrepentirse (RF-23). Sobre una
        entregada o una cancelada no hay nada que hacer desde acá.
      */}
      {activa ? (
        <div className="flex flex-col gap-3">
          {whatsapp ? (
            <Button asChild variant="whatsapp" size="lg" className="w-full">
              <a
                data-ayuda="seguir-whatsapp"
                href={enlaceDeWhatsApp(
                  whatsapp,
                  mensajeDeOrden(
                    orden.numero,
                    orden.customerName,
                    orden.items,
                    total,
                  ),
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconoWhatsApp className="size-4" />
                Escribir por WhatsApp
              </a>
            </Button>
          ) : null}

          <CancelarLaOrden numero={orden.numero} total={total} />
        </div>
      ) : null}
    </section>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-body-sm text-ink-secondary">{titulo}</dt>
      <dd className="text-body-sm text-ink">{valor}</dd>
    </div>
  );
}
