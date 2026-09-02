import type { Metadata } from "next";

import { AvisoDeVerificacion } from "@/components/shop/aviso-verificacion";

export const metadata: Metadata = { title: "Revisá tu email" };

export default async function Verificar({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <AvisoDeVerificacion email={email} />;
}
