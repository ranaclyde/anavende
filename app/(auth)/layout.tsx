import type { Metadata } from "next";
import Link from "next/link";

import { LogoHorizontal } from "@/components/shop/logo";
import { FUERA_DEL_INDICE } from "@/lib/seo";

/**
 * Ninguna de estas pantallas va al índice de un buscador (F3.9). Va en el
 * layout y no en cada página: los metadatos se heredan campo por campo, así
 * que alcanza con declararlo una vez y las páginas siguen poniendo su título.
 */
export const metadata: Metadata = { robots: FUERA_DEL_INDICE };

/**
 * Layout de identidad — pantallas de ingreso, registro y recuperación.
 * Sin encabezado ni pie de tienda: acá no se está explorando
 * (DESIGN-REFERENCE §5.1).
 *
 * La marca es el logo de verdad (§2.3), el mismo del encabezado y del pie. Hasta el 2026-09-10 había un cuadrito con las letras «AV», que era un
 * marcador de posición: la única pantalla donde alguien escribe su
 * contraseña no puede ser la única donde la marca es distinta.
 *
 * La palabra se muestra siempre, y por eso va `<LogoHorizontal>` y no
 * `<Logo>`: ese la oculta por debajo de `sm` porque el encabezado pelea por el ancho. Acá
 * la pantalla está vacía y centrada, y el nombre es lo que dice dónde estás
 * parado.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2.5 rounded-pill"
        aria-label="AnaVende, ir a la tienda"
      >
        <LogoHorizontal />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
