import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { AyudaGuiada, type PasoDeAyuda } from "@/components/ui/ayuda-guiada";
import { Avisos } from "@/components/shop/carrito/avisos";
import { Checkout } from "@/components/shop/checkout/checkout";
import { formatMoney, type Money } from "@/lib/money";
import { NO_INDEX } from "@/lib/seo";
import { getIdentity, getSession } from "@/lib/session";
import { localPhone } from "@/lib/phone";
import { leerCarrito, type ItemDelCarrito } from "@/modules/cart/queries";
import { revisarCarrito } from "@/modules/cart/revision";
import { urlDeImagen } from "@/modules/media/subir";
import { mediosDePagoDeLaTienda } from "@/modules/settings/queries";
import { MAXIMO_DE_DIRECCIONES } from "@/modules/users/direcciones/constantes";
import { listarDirecciones } from "@/modules/users/direcciones/operaciones";

export const metadata: Metadata = {
  title: "Confirmá tu pedido",
  robots: NO_INDEX,
};

// Los medios de pago son opcionales: sin ninguno cargado la sección no existe.
const PASOS_DEL_CHECKOUT: PasoDeAyuda[] = [
  {
    elemento: "entrega",
    titulo: "¿Envío o retiro?",
    texto:
      "Te lo llevamos o pasás a buscarlo, como te quede mejor. El costo del envío lo charlamos por WhatsApp.",
  },
  {
    elemento: "pagos",
    titulo: "¿Con qué pagás?",
    texto:
      "Para que vayas viendo cuál te queda más cómodo. Lo elegís cuando coordinamos.",
    opcional: true,
  },
  {
    elemento: "confirmar-pedido",
    titulo: "Último paso",
    texto:
      "Al confirmar te guardamos lo que elegiste y le avisamos a la vendedora. Después seguimos por WhatsApp.",
  },
];

/**
 * Con el carrito fuera de regla, o la baja pedida, vuelve al carrito: es la
 * pantalla que sabe explicar cada caso. Un precio que cambia después de abrir
 * lo ataja la creación de la orden (TS §8.4). La clave de idempotencia es una
 * por cada vez que se arma la página: un doble clic devuelve la misma orden.
 */
export default async function PaginaDelCheckout() {
  const sesion = await getSession();

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/checkout");
  }

  const { profile, identity } = sesion;
  if (profile.closureRequestedAt != null) redirect("/carrito");

  // La revisión va antes de leer el carrito: lo que se muestra tiene que ser
  // lo ya ajustado.
  const [avisos, direcciones, mediosDePago] = await Promise.all([
    revisarCarrito(profile.id),
    listarDirecciones(profile.id),
    mediosDePagoDeLaTienda(),
  ]);
  const carrito = await leerCarrito(profile.id);

  if (
    carrito.items.length === 0 ||
    carrito.items.some((i) => i.estado !== "vigente")
  ) {
    redirect("/carrito");
  }

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 pb-7">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-title text-ink">Confirmá tu pedido</h1>
          <AyudaGuiada
            id="checkout"
            pasos={PASOS_DEL_CHECKOUT}
            className="-mr-2"
          />
        </div>
        <p className="text-body text-ink-secondary">
          Revisá tus datos y cómo lo recibís. No se cobra nada acá: el pago lo
          coordinamos por WhatsApp.
        </p>
      </header>

      {avisos.length > 0 ? (
        <div className="pb-6">
          <Avisos avisos={avisos} />
        </div>
      ) : null}

      <Checkout
        clave={randomUUID()}
        email={identity.email ?? profile.email}
        emailVerificado={identity.emailVerified}
        nombreInicial={profile.fullName}
        telefonoInicial={localPhone(profile.phone)}
        direcciones={direcciones.map((d) => ({
          id: d.id,
          nombre: d.label,
          detalle:
            `${d.street} ${d.number}` +
            (d.apartment ? `, ${d.apartment}` : "") +
            ` · ${d.city} · Recibe ${d.recipientName}`,
        }))}
        maximoAlcanzado={direcciones.length >= MAXIMO_DE_DIRECCIONES}
        nuevaDireccion={{
          label: "",
          recipientName: profile.fullName,
          phone: localPhone(profile.phone),
          street: "",
          number: "",
          apartment: "",
          localidad: "",
          otraLocalidad: "",
          provinciaDeOtra: "",
          notes: "",
        }}
        esperado={carrito.items.map((i) => ({
          variantId: i.variantId,
          unitPrice: i.precioFinal,
          quantity: i.cantidad,
        }))}
        mediosDePago={mediosDePago.map((m) => ({ id: m.id, nombre: m.nombre }))}
        resumen={
          <Resumen
            items={carrito.items}
            total={carrito.total}
            unidades={carrito.unidades}
          />
        }
      />
    </div>
  );
}

/**
 * Se dibuja en el servidor y entra armado al formulario: los montos no se
 * suman en el navegador (§7.1).
 */
function Resumen({
  items,
  total,
  unidades,
}: {
  items: ItemDelCarrito[];
  total: Money;
  unidades: number;
}) {
  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.variantId} className="flex gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-image bg-surface-sunken">
              {item.imagenKey ? (
                <Image
                  src={urlDeImagen(item.imagenKey, "thumb")}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-body-sm font-medium text-ink">{item.nombre}</p>
              <p className="text-caption text-ink-secondary tabular-nums">
                {item.colorNombre ? `${item.colorNombre} · ` : ""}
                {item.cantidad} × {formatMoney(item.precioFinal)}
              </p>
            </div>
            <p className="text-body-sm font-medium text-ink tabular-nums">
              {formatMoney(item.subtotal)}
            </p>
          </li>
        ))}
      </ul>

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
        Sin costo de envío: se coordina y se paga aparte.
      </p>
    </>
  );
}
