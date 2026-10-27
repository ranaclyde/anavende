import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompletarPerfilForm } from "@/components/shop/completar-perfil-form";
import { getIdentity, getSession } from "@/lib/session";
import { nombreDeGoogle } from "@/modules/users/datos-de-google";

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

  // Nombre y apellido por separado si Google los dio; si no, el formulario
  // parte el nombre completo.
  const [{ volver }, deGoogle] = await Promise.all([
    searchParams,
    nombreDeGoogle(identidad.userId),
  ]);
  return (
    <CompletarPerfilForm
      email={identidad.email}
      nombreSugerido={identidad.nombreSugerido}
      separado={deGoogle}
      volver={volver}
    />
  );
}
