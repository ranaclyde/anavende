import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompletarPerfilForm } from "@/components/shop/completar-perfil-form";
import { getIdentity, getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Completá tu perfil" };

/**
 * Pantalla del paso que falta después de entrar por Google o Facebook
 * (RF-06, TECHNICAL-SPEC §13.4): ningún proveedor social entrega teléfono.
 */
export default async function CompletarPerfil({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const identidad = await getIdentity();
  if (!identidad) redirect("/ingresar");

  // Con perfil ya no hay nada que completar.
  if (await getSession()) redirect("/mi-cuenta");

  const { volver } = await searchParams;
  return (
    <CompletarPerfilForm
      email={identidad.email}
      nombreSugerido={identidad.nombreSugerido}
      volver={volver}
    />
  );
}
