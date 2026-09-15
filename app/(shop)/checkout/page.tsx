import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Avisos } from "@/components/shop/carrito/avisos";
import { Checkout } from "@/components/shop/checkout/checkout";
import { formatMoney, type Money } from "@/lib/money";
import { getIdentity, getSession } from "@/lib/session";
import { leerCarrito, type ItemDelCarrito } from "@/modules/cart/queries";
import { revisarCarrito } from "@/modules/cart/revision";
import { urlDeImagen } from "@/modules/media/subir";
import { mediosDePagoDeLaTienda } from "@/modules/settings/queries";
import { MAXIMO_DE_DIRECCIONES } from "@/modules/users/direcciones/constantes";
import { listarDirecciones } from "@/modules/users/direcciones/operaciones";

export const metadata: Metadata = { title: "Confirmá tu pedido" };

/**
 * El checkout — FS RF-11 · TS §8.4, §8.5. Tarea F6.1.
 *
 * Una sola página con secciones: tus datos, cómo lo recibís (envío o retiro,
 * decisión del 2026-09-14), medios de pago y el resumen con «Confirmar
 * pedido». Solo el envío pide dirección.
 *
 * **Se llega con el carrito en regla, o se vuelve a él.** Vacío, con algo sin
 * stock o que ya no se vende, manda al carrito, que es la pantalla que sabe
 * explicar cada caso. Con la baja pedida (F5.8) también: ahí el botón está
 * apagado y dice por qué.
 *
 * **Revisa el carrito al abrirse, como el carrito** (F5.6): un precio que
 * cambió se avisa arriba y el resumen ya muestra el vigente. Si cambia
 * DESPUÉS, mientras la persona completa los datos, lo ataja la creación de
 * la orden (§8.4 paso 3) y la pantalla se vuelve a armar con lo nuevo.
 *
 * **La clave de idempotencia nace acá** (§8.5): una por cada vez que se arma
 * la página. Un doble clic o un reintento del navegador llevan la misma y
 * devuelven la misma orden.
 */
export default async function PaginaDelCheckout() {
  const sesion = await getSession();

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/checkout");
  }

  const { profile, identity } = sesion;
  if (profile.closureRequestedAt != null) redirect("/carrito");

  // La revisión antes de leer el carrito, como en el carrito: lo que se
  // muestra tiene que ser lo ya ajustado. Las direcciones y los medios de
  // pago no dependen de eso, así que van en paralelo con la revisión.
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
        <h1 className="text-title text-ink">Confirmá tu pedido</h1>
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
        telefonoInicial={profile.phone.replace(/^\+549/, "")}
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
          phone: profile.phone.replace(/^\+549/, ""),
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
 * Los ítems y el total (RF-11, sección 3). Se dibuja en el servidor y entra
 * al formulario ya armado: el navegador no necesita las fotos ni los precios
 * para nada más que mostrarlos, y los montos no se suman ahí (§7.1).
 *
 * **El total no incluye envío** (RN-10): se coordina y se paga aparte.
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
