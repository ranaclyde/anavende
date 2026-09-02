import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/shop/login-form";
import { getIdentity } from "@/lib/session";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Ingresar({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  // Quien ya entró no tiene nada que hacer acá.
  if (await getIdentity()) redirect("/mi-cuenta");

  const { volver } = await searchParams;
  return <LoginForm volver={volver} />;
}
