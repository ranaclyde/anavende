import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { TooltipProvider } from "@/components/ui/tooltip";
import { urlDelSitio } from "@/lib/env";
import { NOMBRE_DEL_SITIO, OPEN_GRAPH_BASE, ZONA_DE_ENTREGA } from "@/lib/seo";

const siteUrl = urlDelSitio();

// DESIGN-REFERENCE §3.3 y §12.3: una sola familia, pesos 400, 500 y 600.
// No se carga 700 ni superior.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const DESCRIPCION = `Teclados, mouses, auriculares, cables y memorias. ${ZONA_DE_ENTREGA}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: NOMBRE_DEL_SITIO,
    template: `%s · ${NOMBRE_DEL_SITIO}`,
  },
  description: DESCRIPCION,
  /*
   * El respaldo de la vista previa, para las pantallas que no declaran la
   * suya (F3.9). **Sin `url`**: cada página es una dirección distinta y un
   * `og:url` heredado apuntaría a la raíz desde todas.
   *
   * La imagen no está acá: la pone `app/opengraph-image.png`, que Next suma
   * solo a lo que no traiga imagen propia.
   */
  openGraph: {
    ...OPEN_GRAPH_BASE,
    title: NOMBRE_DEL_SITIO,
    description: DESCRIPCION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El modo oscuro vive solo en /admin (DESIGN-REFERENCE §3.2): la raíz
  // no declara data-theme y la tienda es siempre clara.
  return (
    // `suppressHydrationWarning` cubre SOLO los atributos de <html>, y hace
    // falta: el script anti-destello del panel escribe `data-theme` antes de
    // que React hidrate (DESIGN-REFERENCE §3.2), así que el servidor y el
    // cliente difieren a propósito. Sin esto, cada visita al panel deja una
    // advertencia en la consola que después tapa las de verdad.
    <html lang="es-AR" className={inter.variable} suppressHydrationWarning>
      {/*
        Radix exige un proveedor arriba de cualquier tooltip. Va en la raíz y
        no en la tienda para que el panel pueda usarlos sin repetirlo.
      */}
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
