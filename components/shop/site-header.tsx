"use client";

import { Heart, Search, ShoppingCart, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Logo } from "@/components/shop/logo";
import {
  MenuDelTelefono,
  NavegacionPrincipal,
} from "@/components/shop/navegacion-principal";
import { SearchBox } from "@/components/shop/search-box";
import { Avatar } from "@/components/ui/avatar";
import type { Escena } from "@/lib/escenas";
import { cn } from "@/lib/utils";

/**
 * Encabezado de la tienda — DESIGN-REFERENCE §5.1.
 *
 * 56px, blanco, FIJO, y gana --shadow-lg al hacer scroll: mientras la página
 * está arriba el encabezado se apoya en el canvas sin separarse; en cuanto
 * hay contenido debajo, la sombra explica que está por encima.
 *
 * **La navegación va al lado del logo** (2026-10-21): Catálogo, Categorías y
 * Ofertas, con la píldora que viaja (`NavegacionPrincipal`). En el teléfono no
 * entran y pasan a un menú lateral, que se lleva también la cuenta.
 *
 * **El buscador es una lupa en todos los tamaños** y se abre a ancho completo
 * debajo. Abierto en escritorio le quitaba a los enlaces el lugar que
 * necesitan entre 768 y 1024px, y donde más se busca —la home y el catálogo—
 * la página ya trae uno grande.
 *
 * **El buscador no se dibuja si la página ya tiene el suyo** (F3.8). La regla
 * vive en `globals.css`; vuelve solo en cuanto el de la página sale de la
 * pantalla. Ver `SearchBox`, prop `principal`.
 */
export function SiteHeader({
  cartCount = 0,
  userName,
  userCara = null,
  escena = null,
}: {
  cartCount?: number;
  userName?: string | null;
  /** La foto o el blobatar de quien entró (F5.9), ya resuelto en el servidor. */
  userCara?: string | null;
  /** La escena por fecha de hoy (F9.5): el logo lleva su adorno. */
  escena?: Escena | null;
}) {
  const [conSombra, setConSombra] = useState(false);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const lupa = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const alScrollear = () => setConSombra(window.scrollY > 0);
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  // El buscador abierto se cierra al navegar: si no, tapa la página que llega.
  // Se ajusta durante el render, cuando cambia la ruta, y no en un efecto:
  // así no se pinta un cuadro con el buscador abierto sobre la página nueva.
  const [rutaVista, setRutaVista] = useState(pathname);
  if (rutaVista !== pathname) {
    setRutaVista(pathname);
    setBuscadorAbierto(false);
  }

  // El número salta cuando SUBE: agregar desde la ficha refresca la pantalla
  // y el encabezado recibe el número nuevo. Quitar no salta, porque el salto
  // dice «acá fue a parar». Cada salto cambia la `key` del número, y así la
  // animación vuelve a empezar aunque se agregue dos veces seguidas. Se ajusta
  // al pintar, como la ruta de arriba, y nunca en la primera carga.
  const [cuentaVista, setCuentaVista] = useState(cartCount);
  const [saltos, setSaltos] = useState(0);
  if (cuentaVista !== cartCount) {
    if (cartCount > cuentaVista) setSaltos((n) => n + 1);
    setCuentaVista(cartCount);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-surface transition-shadow duration-150",
        // Que nada de una View Transition le pase por encima (`globals.css`).
        "[view-transition-name:encabezado]",
        conSombra && "shadow-lg",
      )}
    >
      <div className="mx-auto flex h-14 max-w-shop items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MenuDelTelefono
          userName={userName}
          userCara={userCara}
          escena={escena}
        />
        <Logo escena={escena} />
        <NavegacionPrincipal />

        <div className="flex-1" />

        <nav aria-label="Tu cuenta" className="flex items-center gap-1">
          <button
            ref={lupa}
            type="button"
            data-buscador-navbar
            onClick={() => setBuscadorAbierto((v) => !v)}
            aria-expanded={buscadorAbierto}
            aria-controls="buscador-del-encabezado"
            className="grid size-11 place-items-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
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

          {/*
            Píldora y no un ícono con insignia encima: la insignia de 18px
            sobre el ícono obliga a entrecerrar los ojos (F3.8). Vacía es solo
            el carrito; con algo adentro, el número va en un círculo burdeos
            de 28px (2026-10-21), que se lee como insignia sin achicarse.
          */}
          <Link
            href="/carrito"
            className={cn(
              "ml-1 flex h-10 items-center gap-2 rounded-pill border border-border bg-surface text-body-sm text-ink shadow-sm transition-shadow duration-150 hover:shadow-md max-md:h-11",
              cartCount > 0 ? "pr-1.5 pl-3.5" : "px-3.5",
            )}
          >
            <ShoppingCart aria-hidden className="size-4 shrink-0" />
            {cartCount > 0 ? (
              <span
                key={saltos}
                aria-hidden
                className={cn(
                  "grid h-7 min-w-7 place-items-center rounded-pill bg-brand px-1.5 text-caption font-semibold text-ink-inverse tabular-nums",
                  saltos > 0 && "motion-safe:animate-salto",
                )}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
            <span className="sr-only">
              {cartCount > 0
                ? `Carrito, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}`
                : "Carrito, vacío"}
            </span>
          </Link>

          {/* En el teléfono la cuenta está en el menú. */}
          <Link
            href={userName ? "/mi-cuenta" : "/ingresar"}
            className={cn(
              "flex h-11 items-center gap-2 rounded-pill px-3 text-body-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink max-md:hidden",
              // Con la cara, el círculo de 32px llena el alto del ícono y un
              // poco más: se le saca relleno para que el texto no quede lejos.
              userCara && "pl-1.5 lg:pr-3",
            )}
          >
            {userCara ? (
              <Avatar src={userCara} tamano={32} />
            ) : (
              <User aria-hidden className="size-5 shrink-0" />
            )}
            <span className="hidden max-w-28 truncate lg:inline">
              {userName ?? "Ingresar"}
            </span>
            {/* Sin el texto a la vista, el ícono solo no tiene nombre. */}
            <span className="sr-only lg:hidden">
              {userName ? "Mi cuenta" : "Ingresar"}
            </span>
          </Link>
        </nav>
      </div>

      {/* El buscador se despliega a ancho completo; Escape lo cierra y
          devuelve el foco a la lupa. */}
      {buscadorAbierto && (
        <div
          id="buscador-del-encabezado"
          data-buscador-navbar
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setBuscadorAbierto(false);
              lupa.current?.focus();
            }
          }}
          className="border-t border-border"
        >
          <div className="mx-auto max-w-shop px-4 py-3 sm:px-6 lg:px-8">
            <SearchBox autoFocus className="md:mx-auto md:max-w-140" />
          </div>
        </div>
      )}
    </header>
  );
}

function AccionDelEncabezado({
  href,
  etiqueta,
  children,
}: {
  href: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="grid size-11 place-items-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
    >
      {children}
      <span className="sr-only">{etiqueta}</span>
    </Link>
  );
}
