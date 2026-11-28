import type { Metadata } from "next";
import "./globals.css";

import { getSiteUrl } from "@/lib/env";
import { inter } from "@/lib/font";
import { LOGO_SEEN_SCRIPT } from "@/lib/logo";
import { SITE_NAME, OPEN_GRAPH_BASE, DELIVERY_AREA } from "@/lib/seo";

const siteUrl = getSiteUrl();

const DESCRIPCION = `Teclados, mouses, auriculares, cables y memorias. ${DELIVERY_AREA}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPCION,
  // Sin `url`: heredado, apuntaría a la raíz desde todas las páginas. La
  // imagen la pone `app/opengraph-image.png`.
  openGraph: {
    ...OPEN_GRAPH_BASE,
    title: SITE_NAME,
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
        <script dangerouslySetInnerHTML={{ __html: LOGO_SEEN_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
