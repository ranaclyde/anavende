import type { Metadata } from "next";
import "./globals.css";

import { urlDelSitio } from "@/lib/env";
import { inter } from "@/lib/fuente";
import { SCRIPT_MARCA_VISTA } from "@/lib/marca";
import { NOMBRE_DEL_SITIO, OPEN_GRAPH_BASE, ZONA_DE_ENTREGA } from "@/lib/seo";

const siteUrl = urlDelSitio();

const DESCRIPCION = `Teclados, mouses, auriculares, cables y memorias. ${ZONA_DE_ENTREGA}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: NOMBRE_DEL_SITIO,
    template: `%s · ${NOMBRE_DEL_SITIO}`,
  },
  description: DESCRIPCION,
  // Sin `url`: heredado, apuntaría a la raíz desde todas las páginas. La
  // imagen la pone `app/opengraph-image.png`.
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
  return (
    // `suppressHydrationWarning` hace falta: el script anti-destello del panel
    // escribe `data-theme` antes de que React hidrate. Cubre SOLO a <html>.
    <html lang="es-AR" className={inter.variable} suppressHydrationWarning>
      <body>
        {/* Antes del primer pintado, para que una recarga no repita la
            animación del hero (`marca-del-hero.tsx`). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MARCA_VISTA }} />
        {children}
      </body>
    </html>
  );
}
