import type { Metadata } from "next";

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
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-ink">Catálogo</h1>
        <p className="text-body-sm text-ink-secondary">
          Las marcas, categorías y colores con los que se cargan los productos.
        </p>
      </div>

      <SolapasDeCatalogo />

      {children}
    </div>
  );
}
