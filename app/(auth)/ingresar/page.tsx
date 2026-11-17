import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/shop/login-form";
import { destinoInterno } from "@/lib/destino";
import { getIdentity, getSession } from "@/lib/session";
import { numeroDeWhatsApp } from "@/modules/settings/queries";
import { proveedoresDisponibles } from "@/modules/users/proveedores";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Ingresar({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const [identidad, sesion, { volver }] = await Promise.all([
    getIdentity(),
    // Sin identidad no va a la base: `getSession` corta antes de leer el
    // perfil, así que a quien no entró no le cuesta nada.
    getSession(),
    searchParams,
  ]);

  // Quien ya entró no tiene nada que hacer acá. **Salvo que le falte el
  // perfil** (§13.4): quien entró con Google y no lo completó ve «Ingresar»
  // en el encabezado y «Iniciá sesión para comprar» en la ficha, y llega acá.
  // Va a completarlo y **conserva la vuelta**, para que al terminar vuelva a
  // la ficha y la compra pendiente se retome (F5.7). Solo destinos internos
  // (`lib/destino.ts`).
  if (identidad && !sesion) {
    const interno = destinoInterno(volver);
    redirect(
      interno
        ? `/completar-perfil?volver=${encodeURIComponent(interno)}`
        : "/completar-perfil",
    );
  }
  if (identidad) redirect("/mi-cuenta");

  /**
   * El canal de contacto del aviso de cuenta bloqueada (RF-27, RF-06): el
   * requisito pide el motivo **y** por dónde reclamar, y hasta F7.7 eso era
   * una frase que nombraba WhatsApp sin llevar a ningún lado.
   *
   * Se lee siempre y no solo cuando hace falta, porque cuando hace falta ya
   * estamos en el navegador. Sin número, el aviso se muestra sin el enlace:
   * un `wa.me` vacío abre WhatsApp en la nada.
   */
  const [whatsapp, proveedores] = await Promise.all([
    numeroDeWhatsApp().catch((error: unknown) => {
      console.error("[ingresar] No se pudo leer el número de WhatsApp.", error);
      return null;
    }),
    proveedoresDisponibles(),
  ]);

  return (
    <LoginForm volver={volver} whatsapp={whatsapp} proveedores={proveedores} />
  );
}
