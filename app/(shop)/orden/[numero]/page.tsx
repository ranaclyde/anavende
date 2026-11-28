import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RenglonDelPedido } from "@/components/shop/compras/renglon";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { formatMoney } from "@/lib/money";
import { NO_INDEX } from "@/lib/seo";
import { getIdentity, getSession } from "@/lib/session";
import { whatsappLink, orderMessage } from "@/lib/whatsapp";
import { formaDeEntrega } from "@/modules/orders/entrega";
import { leerOrdenDelComprador } from "@/modules/orders/queries";
import { emailDeAvisos, numeroDeWhatsApp } from "@/modules/settings/queries";

export const metadata: Metadata = {
  title: "Pedido registrado",
  robots: NO_INDEX,
};

type Props = { params: Promise<{ numero: string }> };

/**
 * Solo lee: la orden ya se creó en la acción del checkout, así que recargar no
 * duplica nada. Una orden ajena es un 404, igual que una que no existe.
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

  // Las de configuración van juntas con la orden aunque termine en 404:
  // encadenarlas atrasaría el camino de siempre para ahorrar en el raro.
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
        Verde y no burdeos: el burdeos está a 7° del rojo de error (§2.2).
        La animación (`globals.css`: `anillo`, `relleno`, `tilde`) dura unos
        1,15 s y pasa el techo de §8 a propósito: en 300 ms se veía tosca.
        `stroke-dasharray`: 453 es la vuelta del círculo (2π·72) y 100 cubre
        el tilde (≈ 97).
      */}
      <svg
        aria-hidden
        viewBox="0 0 154 154"
        className="size-16 overflow-visible"
      >
        {/* Arranca arriba, como las agujas del reloj, y no a las tres. */}
        <circle
          cx="77"
          cy="77"
          r="72"
          fill="none"
          strokeWidth="4"
          transform="rotate(-90 77 77)"
          className="stroke-success [stroke-dasharray:453] motion-safe:animate-anillo"
        />
        <circle
          cx="77"
          cy="77"
          r="72"
          className="origin-center fill-success [transform-box:fill-box] motion-safe:animate-relleno"
        />
        <polyline
          points="43.5,77.8 63.7,97.9 112.2,49.4"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink-inverse [stroke-dasharray:100] motion-safe:animate-tilde"
        />
      </svg>

      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink">
          ¡Listo, tu pedido #{orden.numero} quedó registrado!
        </h1>
        {/* Primero quién se enteró: la primera pregunta es «¿alguien me contesta?». */}
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
          Sin número no se dibuja: la fila de `site_settings` puede no existir,
          y `wa.me/` sin número abre WhatsApp en la nada.
        */}
        {whatsapp ? (
          <Button asChild variant="whatsapp" size="lg" className="w-full">
            <a
              href={whatsappLink(
                whatsapp,
                orderMessage(
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

        {/* Los legales que pide RF-12 ya están en el pie. */}
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href="/mi-cuenta/compras">Ver mis compras</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Las condiciones no son prolijidad: el email sale solo si hay casilla
 * configurada y el WhatsApp solo si hay número. No se promete lo que no va a pasar.
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

  // Sin email, el WhatsApp es lo único que mueve el pedido: no puede sonar a
  // sugerencia.
  const atajo = avisada
    ? "Si querés agilizarlo, escribile por WhatsApp: le llega tu pedido con el número y lo encuentra enseguida."
    : "Escribile a la vendedora por WhatsApp para agilizarlo: le llega tu pedido con el número y lo encuentra enseguida.";

  return `${reserva} ${atajo}`;
}
