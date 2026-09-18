import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RenglonDelPedido } from "@/components/shop/compras/renglon";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { formatMoney } from "@/lib/money";
import { getIdentity, getSession } from "@/lib/session";
import { enlaceDeWhatsApp, mensajeDeOrden } from "@/lib/whatsapp";
import { formaDeEntrega } from "@/modules/orders/entrega";
import { leerOrdenDelComprador } from "@/modules/orders/queries";
import { emailDeAvisos, numeroDeWhatsApp } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Pedido registrado" };

type Props = { params: Promise<{ numero: string }> };

/**
 * La orden recién confirmada — F6.3 a F6.5 · FS RF-12 · DR §7.5.
 *
 * Solo la ve su comprador: una orden ajena es un 404, igual que una que no
 * existe (§13.8).
 *
 * **Recargar no duplica nada** (criterio de RF-12) y no hizo falta hacer nada
 * para lograrlo: esta pantalla sólo lee. La orden se creó en la acción del
 * checkout, con su clave de idempotencia (§8.5), y acá ya existía.
 *
 * **Todo se dibuja en el servidor y no viaja un byte de JavaScript.** El
 * enlace de WhatsApp es un `<a>` con el `href` ya armado: a diferencia de la
 * ficha (F3.6), donde el mensaje cambia con el color y la cantidad que se
 * están mirando, acá el pedido ya está congelado y el mensaje es uno solo.
 */
export default async function PaginaDeLaOrden({ params }: Props) {
  const [{ numero: crudo }, sesion] = await Promise.all([params, getSession()]);

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect(`/ingresar?volver=${encodeURIComponent(`/orden/${crudo}`)}`);
  }

  // Solo dígitos: `parseInt` aceptaría «1043abc» como 1043.
  if (!/^\d{1,9}$/.test(crudo)) notFound();
  const numero = Number.parseInt(crudo, 10);

  // Las tres juntas, y las de configuración aunque la orden termine en 404:
  // no dependen de ella, y encadenarlas pondría una lectura detrás de la otra
  // en el camino que siempre se recorre para ahorrarlas en el que casi nunca.
  const [orden, whatsapp, casillaDeAvisos] = await Promise.all([
    leerOrdenDelComprador(sesion.profile.id, numero),
    numeroDeWhatsApp(),
    emailDeAvisos(),
  ]);
  if (!orden) notFound();

  const direccion = orden.shippingAddress;
  const total = formatMoney(orden.total);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-16 text-center">
      {/*
        Verde y no burdeos: esta pantalla dice «salió bien», y el burdeos está
        a 7° de matiz del rojo de error (§2.2). Un círculo casi rojo con un
        tilde adentro se lee como problema durante el instante que importa.
        El color no es lo único que lo dice: está el tilde y está el título.
      */}
      <div className="flex size-16 items-center justify-center rounded-full bg-success text-ink-inverse">
        <Check aria-hidden className="size-8" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink">
          ¡Listo, tu pedido #{orden.numero} quedó registrado!
        </h1>
        {/*
          Quién ya se enteró, que el stock queda reservado (RF-12) y para qué
          sirve el botón de abajo. En ese orden, porque la primera pregunta de
          quien acaba de confirmar es «¿y ahora alguien me contesta?».
        */}
        <p className="text-body text-ink-secondary">
          {queSigueAhora({ avisada: !!casillaDeAvisos, whatsapp: !!whatsapp })}
        </p>
      </div>

      <div className="flex w-full flex-col gap-4 rounded-card bg-surface p-5 text-left shadow-md">
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

        <div className="flex flex-col gap-0.5 border-t border-border pt-4">
          <p className="text-body-sm text-ink-secondary">Entrega</p>
          <p className="text-body-sm text-ink">
            {formaDeEntrega(orden) === "envio" && direccion
              ? `Te lo enviamos a ${direccion.street} ${direccion.number}${direccion.apartment ? `, ${direccion.apartment}` : ""}, ${direccion.city}.`
              : "Lo retirás: te pasamos por WhatsApp dónde y cuándo."}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        {/*
          **La acción principal** (§7.5): es lo que efectivamente cierra la
          venta, porque el MVP no cobra online (FA-01).

          Sin número configurado no se dibuja, en vez de dibujarse roto: la
          fila de `site_settings` puede no existir (§5.9), y `wa.me/` sin
          número abre WhatsApp en la nada y parece que falló el sitio. En ese
          caso «Ver mis compras» queda como única acción, que es la verdad de
          lo que se puede hacer desde acá.
        */}
        {whatsapp ? (
          <Button asChild variant="brand" size="lg" className="w-full">
            <a
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
              Coordinar pago por WhatsApp
            </a>
          </Button>
        ) : null}

        {/*
          «Ver mis compras», que es lo que pide §7.5 y F6.5 hizo posible: hasta
          que existió el historial esto decía «Seguir mirando», porque un botón
          que lleva a un 404 es peor que uno que lleva a otro lado. Los legales,
          el otro enlace que pide RF-12, ya están en el pie de todas las
          pantallas.
        */}
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href="/mi-cuenta/compras">Ver mis compras</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Qué pasa ahora, en una frase.
 *
 * Son tres piezas que se encienden solas —la vendedora avisada, el stock
 * reservado (RF-12) y el atajo por WhatsApp—, y está acá afuera porque
 * encadenar dos condicionales adentro del JSX partía palabras entre
 * expresiones y no había forma de leer la frase entera de un vistazo.
 *
 * **Las condiciones no son prolijidad.** El email E4 sale solo si hay casilla
 * configurada (F6.4) y el WhatsApp solo si hay número: la fila de
 * `site_settings` puede no existir (§5.9). Prometer cualquiera de los dos sin
 * eso sería decirle al comprador algo que no puede verificar y que no va a
 * pasar.
 */
function queSigueAhora({
  avisada,
  whatsapp,
}: {
  avisada: boolean;
  whatsapp: boolean;
}): string {
  const reserva = avisada
    ? "Ya le avisamos a la vendedora por email y guardamos el stock hasta coordinar el pago."
    : "Guardamos el stock hasta coordinar el pago.";

  if (!whatsapp) return reserva;

  // Con el email ya mandado el WhatsApp es opcional y se dice así; sin él, es
  // lo único que mueve el pedido y la frase no puede sonar a sugerencia.
  const atajo = avisada
    ? "Si querés agilizarlo, escribile por WhatsApp: le llega tu pedido con el número y lo encuentra enseguida."
    : "Escribile a la vendedora por WhatsApp para agilizarlo: le llega tu pedido con el número y lo encuentra enseguida.";

  return `${reserva} ${atajo}`;
}
