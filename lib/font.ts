import { Inter } from "next/font/google";

// La usan el layout raíz y `app/global-error.tsx`, que lo reemplaza entero y
// no hereda nada de él.
export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
