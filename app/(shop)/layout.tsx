import { Suspense } from "react";

import { SiteFooter } from "@/components/shop/site-footer";
import { SiteHeader } from "@/components/shop/site-header";

/**
 * Layout de la tienda — DESIGN-REFERENCE §5.1.
 * Encabezado fijo, contenido sobre el canvas y pie oscuro.
 *
 * El carrito y el nombre de quien está adentro se leen en F5.5 y F1.7c: acá
 * el encabezado ya recibe los dos, para que sumarlos sea pasar datos y no
 * rehacer el layout.
 */
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      {/* El buscador lee la URL, así que el encabezado necesita el límite
          de Suspense que Next exige alrededor de useSearchParams. */}
      <Suspense fallback={<div className="h-14 bg-surface" />}>
        <SiteHeader />
      </Suspense>

      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
