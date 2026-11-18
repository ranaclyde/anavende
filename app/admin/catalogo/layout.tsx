import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { SolapasDeCatalogo } from "@/components/admin/catalogo/tabs";

export const metadata: Metadata = { title: "Catálogo" };

/**
 * Catálogo del panel — RF-18.
 * Marcas, categorías y colores comparten encabezado y solapas.
 */
export default function CatalogoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePanel
        titulo="Catálogo"
        bajada="Marcas, categorías, colores y medios de pago."
      />

      <SolapasDeCatalogo />

      {children}
    </div>
  );
}
