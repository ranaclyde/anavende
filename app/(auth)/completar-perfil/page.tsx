import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompletarPerfilForm } from "@/components/shop/completar-perfil-form";
import { getIdentity, getSession } from "@/lib/session";
import { nombreDeGoogle } from "@/modules/users/datos-de-google";

export const metadata: Metadata = { title: "Completá tu perfil" };

/** Ningún proveedor social entrega el teléfono (§13.4). */
export default async function CompletarPerfil({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const identidad = await getIdentity();
  if (!identidad) redirect("/ingresar");

  if (await getSession()) redirect("/mi-cuenta");

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
