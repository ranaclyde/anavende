import Link from "next/link";

import { Isotipo } from "@/components/shop/logo";

/**
 * Layout de identidad — pantallas de ingreso, registro y recuperación.
 * Sin encabezado ni pie de tienda: acá no se está explorando
 * (DESIGN-REFERENCE §5.1).
 *
 * La marca es el `Isotipo` de verdad (§2.3), el mismo del encabezado y del
 * pie. Hasta el 2026-09-10 había un cuadrito con las letras «AV», que era un
 * marcador de posición: la única pantalla donde alguien escribe su
 * contraseña no puede ser la única donde la marca es distinta.
 *
 * El wordmark se muestra siempre, y por eso no se usa `<Logo>`: ese oculta
 * el texto por debajo de `sm` porque el encabezado pelea por el ancho. Acá
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
        <Isotipo />
        <span className="text-heading text-ink">AnaVende</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
