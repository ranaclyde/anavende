"use client";

import { Heart, Search, ShoppingCart, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/shop/logo";
import { SearchBox } from "@/components/shop/search-box";
import { cn } from "@/lib/utils";

/**
 * Encabezado de la tienda — DESIGN-REFERENCE §5.1.
 *
 * 56px, blanco, FIJO, y gana --shadow-lg al hacer scroll: mientras la página
 * está arriba el encabezado se apoya en el canvas sin separarse; en cuanto
 * hay contenido debajo, la sombra explica que está por encima.
 *
 * En móvil el buscador colapsa a un ícono y se abre a ancho completo.
 */
export function SiteHeader({
  cartCount = 0,
  userName,
}: {
  cartCount?: number;
  userName?: string | null;
}) {
  const [conSombra, setConSombra] = useState(false);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const alScrollear = () => setConSombra(window.scrollY > 0);
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  // El buscador abierto se cierra al navegar: si no, tapa la página que llega.
  useEffect(() => setBuscadorAbierto(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-surface transition-shadow duration-150",
        conSombra && "shadow-lg",
      )}
    >
      <div className="mx-auto flex h-14 max-w-shop items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Logo />

        {/* Escritorio: el buscador es la pieza central del encabezado. */}
        <div className="mx-auto hidden w-full max-w-md md:block">
          <SearchBox />
        </div>

        <nav aria-label="Tu cuenta" className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBuscadorAbierto((v) => !v)}
            aria-expanded={buscadorAbierto}
            className="grid size-11 place-items-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink md:hidden"
          >
            {buscadorAbierto ? (
              <X aria-hidden className="size-5" />
            ) : (
              <Search aria-hidden className="size-5" />
            )}
            <span className="sr-only">
              {buscadorAbierto ? "Cerrar el buscador" : "Buscar productos"}
            </span>
          </button>

          <AccionDelEncabezado href="/mi-cuenta/favoritos" etiqueta="Favoritos">
            <Heart aria-hidden className="size-5" />
          </AccionDelEncabezado>

          <AccionDelEncabezado
            href="/carrito"
            etiqueta={
              cartCount > 0
                ? `Carrito, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}`
                : "Carrito, vacío"
            }
            insignia={cartCount}
          >
            <ShoppingCart aria-hidden className="size-5" />
          </AccionDelEncabezado>

          <Link
            href={userName ? "/mi-cuenta" : "/ingresar"}
            className="flex h-11 items-center gap-2 rounded-pill px-3 text-body-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
          >
            <User aria-hidden className="size-5 shrink-0" />
            <span className="hidden max-w-28 truncate lg:inline">
              {userName ?? "Ingresar"}
            </span>
          </Link>
        </nav>
      </div>

      {/* Móvil: el buscador se despliega a ancho completo. */}
      {buscadorAbierto && (
        <div className="border-t border-border px-4 py-3 md:hidden">
          <SearchBox autoFocus />
        </div>
      )}
    </header>
  );
}

function AccionDelEncabezado({
  href,
  etiqueta,
  insignia,
  children,
}: {
  href: string;
  etiqueta: string;
  insignia?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="relative grid size-11 place-items-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
    >
      {children}
      {/* 12px es el piso absoluto del sistema (§3.3): la insignia no baja de
          ahí aunque el espacio tiente. */}
      {insignia !== undefined && insignia > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-pill bg-brand px-1 text-caption leading-[18px] font-medium text-ink-inverse"
        >
          {insignia > 9 ? "9+" : insignia}
        </span>
      )}
      <span className="sr-only">{etiqueta}</span>
    </Link>
  );
}
