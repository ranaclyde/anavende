import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/shop/login-form";
import { getIdentity } from "@/lib/session";
import { numeroDeWhatsApp } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Ingresar({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  // Quien ya entró no tiene nada que hacer acá.
  if (await getIdentity()) redirect("/mi-cuenta");

  const { volver } = await searchParams;

  /**
   * El canal de contacto del aviso de cuenta bloqueada (RF-27, RF-06): el
   * requisito pide el motivo **y** por dónde reclamar, y hasta F7.7 eso era
   * una frase que nombraba WhatsApp sin llevar a ningún lado.
   *
   * Se lee siempre y no solo cuando hace falta, porque cuando hace falta ya
   * estamos en el navegador. Sin número, el aviso se muestra sin el enlace:
   * un `wa.me` vacío abre WhatsApp en la nada.
   */
  const whatsapp = await numeroDeWhatsApp().catch((error: unknown) => {
    console.error("[ingresar] No se pudo leer el número de WhatsApp.", error);
    return null;
  });

  return <LoginForm volver={volver} whatsapp={whatsapp} />;
}
