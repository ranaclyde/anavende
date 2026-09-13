import type { Metadata } from "next";

import { AvisoDeVerificacion } from "@/components/shop/aviso-verificacion";

export const metadata: Metadata = { title: "Revisá tu email" };

export default async function Verificar({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; volver?: string }>;
}) {
  const { email, volver } = await searchParams;
  return <AvisoDeVerificacion email={email} volver={volver} />;
}
