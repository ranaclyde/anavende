import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/shop/sign-up-form";
import { getIdentity } from "@/lib/session";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function Registro({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  if (await getIdentity()) redirect("/mi-cuenta");

  const { volver } = await searchParams;
  return <SignUpForm volver={volver} />;
}
