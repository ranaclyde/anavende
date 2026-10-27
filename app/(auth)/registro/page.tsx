import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/shop/sign-up-form";
import { getIdentity } from "@/lib/session";
import { proveedoresDisponibles } from "@/modules/users/proveedores";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function Registro({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  if (await getIdentity()) redirect("/mi-cuenta");

  const [{ volver }, proveedores] = await Promise.all([
    searchParams,
    proveedoresDisponibles(),
  ]);
  return <SignUpForm volver={volver} proveedores={proveedores} />;
}
