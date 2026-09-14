import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getIdentity, getSession } from "@/lib/session";
import { formaDeEntrega } from "@/modules/orders/entrega";
import { leerOrdenDelComprador } from "@/modules/orders/queries";

export const metadata: Metadata = { title: "Pedido registrado" };

type Props = { params: Promise<{ numero: string }> };

/**
 * La orden recién confirmada — FS RF-12 · DESIGN-REFERENCE §7.5.
 *
 * **Es la mitad de F6.3, a propósito.** F6.1 necesita un lugar a donde llegar
 * después de confirmar, y ese lugar es este. Acá están el número, el total y
 * cómo se entrega; F6.3 suma el botón de WhatsApp como acción principal, el
 * detalle de los ítems y «Ver mis compras».
 *
 * Solo la ve su comprador: una orden ajena es un 404, igual que una que no
 * existe (§13.8).
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

  const orden = await leerOrdenDelComprador(sesion.profile.id, numero);
  if (!orden) notFound();

  const direccion = orden.shippingAddress;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-brand text-ink-inverse">
        <Check aria-hidden className="size-8" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink">
          ¡Listo, tu pedido #{orden.numero} quedó registrado!
        </h1>
        <p className="text-body text-ink-secondary">
          Guardamos el stock hasta que coordinemos el pago.
        </p>
      </div>

      <dl className="flex w-full flex-col gap-3 rounded-card bg-surface p-5 text-left shadow-md">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-body text-ink">
            Total{" "}
            <span className="text-body-sm text-ink-secondary">
              ({orden.unidades} {orden.unidades === 1 ? "unidad" : "unidades"})
            </span>
          </dt>
          <dd className="text-heading font-medium text-ink tabular-nums">
            {formatMoney(orden.total)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 border-t border-border pt-3">
          <dt className="text-body-sm text-ink-secondary">Entrega</dt>
          <dd className="text-body-sm text-ink">
            {formaDeEntrega(orden) === "envio" && direccion
              ? `Te lo enviamos a ${direccion.street} ${direccion.number}${direccion.apartment ? `, ${direccion.apartment}` : ""}, ${direccion.city}.`
              : "Lo retirás: te pasamos por WhatsApp dónde y cuándo."}
          </dd>
        </div>
      </dl>

      <Button asChild variant="secondary" size="lg">
        <Link href="/productos">Seguir mirando</Link>
      </Button>
    </div>
  );
}
