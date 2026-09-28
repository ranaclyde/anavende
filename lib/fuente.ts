import { Inter } from "next/font/google";

// DESIGN-REFERENCE §3.3 y §12.3: una sola familia, pesos 400, 500 y 600.
// No se carga 700 ni superior.
//
// Vive acá y no en `app/layout.tsx` porque la usan dos documentos: el layout
// raíz y `app/global-error.tsx`, que lo reemplaza entero cuando falla y no
// hereda nada de él.
export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
