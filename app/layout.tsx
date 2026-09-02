import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// DESIGN-REFERENCE §3.3 y §12.3: una sola familia, pesos 400, 500 y 600.
// No se carga 700 ni superior.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AnaVende",
    template: "%s · AnaVende",
  },
  description:
    "Teclados, mouses, auriculares, cables y memorias. Envíos por PedidosYa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El modo oscuro vive solo en /admin (DESIGN-REFERENCE §3.2): la raíz
  // no declara data-theme y la tienda es siempre clara.
  return (
    <html lang="es-AR">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
