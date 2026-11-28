import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/shop/login-form";
import { internalRedirectTarget } from "@/lib/redirect-target";
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
    getSession(),
    searchParams,
  ]);

  // Sin perfil (entró con Google y no lo completó) va a completarlo y
  // conserva la vuelta, solo si es un destino interno.
  if (identidad && !sesion) {
    const interno = internalRedirectTarget(volver);
    redirect(
      interno
        ? `/completar-perfil?volver=${encodeURIComponent(interno)}`
        : "/completar-perfil",
    );
  }
  if (identidad) redirect("/mi-cuenta");

  // Para el aviso de cuenta bloqueada (RF-27). Se lee siempre: cuando hace
  // falta ya estamos en el navegador.
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
