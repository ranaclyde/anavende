"use client";

import { Menu, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import { Logo } from "@/components/shop/logo";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Scene } from "@/lib/scenes";
import { cn } from "@/lib/utils";

/**
 * La navegación de la tienda (DESIGN-REFERENCE §5.1), la misma en escritorio
 * y en el teléfono. «Ofertas» es el catálogo con el filtro de descuento, así
 * que «Productos» se marca solo cuando ese filtro no está.
 */
const ENLACES = [
  {
    href: "/productos",
    etiqueta: "Productos",
    activo: (ruta: string, oferta: boolean) =>
      (ruta === "/productos" && !oferta) || ruta.startsWith("/productos/"),
  },
  {
    href: "/categorias",
    etiqueta: "Categorías",
    activo: (ruta: string) =>
      ruta === "/categorias" || ruta.startsWith("/categorias/"),
  },
  {
    href: "/productos?oferta=1",
    etiqueta: "Ofertas",
    activo: (ruta: string, oferta: boolean) => ruta === "/productos" && oferta,
  },
  {
    href: "/contacto",
    etiqueta: "Contacto",
    activo: (ruta: string) => ruta === "/contacto",
  },
];

function useEnlaceActivo(): number {
  const ruta = usePathname();
  const oferta = useSearchParams().get("oferta") === "1";
  return ENLACES.findIndex((e) => e.activo(ruta, oferta));
}

/** Los bordes de la píldora, medidos desde cada lado de la lista. */
type Caja = { izq: number; der: number; haciaLaDerecha: boolean };

/**
 * Los enlaces de escritorio, con una píldora que sigue al mouse y al foco y
 * viaja como una gota: el borde de adelante llega antes que el de atrás, así
 * que se estira en el viaje. Al hacer clic suelta una ráfaga de puntos.
 */
export function NavegacionPrincipal() {
  const activo = useEnlaceActivo();
  const [apuntado, setApuntado] = useState<number | null>(null);
  const objetivo = apuntado ?? activo;

  const lista = useRef<HTMLUListElement>(null);
  const enlaces = useRef<(HTMLAnchorElement | null)[]>([]);
  const [caja, setCaja] = useState<Caja | null>(null);
  // La primera vez que aparece no viaja: se enciende en su lugar.
  const [viaja, setViaja] = useState(false);
  const ultima = useRef<Caja | null>(null);

  // Antes de pintar, o se vería un cuadro con la píldora en el enlace
  // anterior. Se remide si la lista cambia de ancho al cargar la fuente.
  useLayoutEffect(() => {
    const ul = lista.current;
    if (!ul) return;
    function medir() {
      const el = objetivo >= 0 ? enlaces.current[objetivo] : null;
      if (!ul || !el) {
        ultima.current = null;
        setViaja(false);
        return;
      }
      const antes = ultima.current;
      // Contra la lista y no `offsetLeft`, que mide contra el `<li>`.
      const lugar = el.getBoundingClientRect();
      const borde = ul.getBoundingClientRect();
      const izq = lugar.left - borde.left;
      const nueva = {
        izq,
        der: borde.right - lugar.right,
        haciaLaDerecha: antes === null || izq >= antes.izq,
      };
      ultima.current = nueva;
      setViaja(antes !== null);
      setCaja(nueva);
    }
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(ul);
    return () => observador.disconnect();
  }, [objetivo]);

  function rafaga(el: HTMLElement) {
    const ul = lista.current;
    if (!ul || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const lugar = el.getBoundingClientRect();
    const borde = ul.getBoundingClientRect();
    const x = lugar.left - borde.left + lugar.width / 2;
    const y = lugar.top - borde.top + lugar.height / 2;
    for (let i = 0; i < 8; i++) {
      const punto = document.createElement("span");
      punto.setAttribute("aria-hidden", "true");
      punto.className =
        "pointer-events-none absolute size-2 rounded-pill bg-brand";
      punto.style.left = `${x - 4}px`;
      punto.style.top = `${y - 4}px`;
      ul.appendChild(punto);
      const angulo = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const radio = 26 + Math.random() * 16;
      const dx = Math.cos(angulo) * (lugar.width / 2 + radio * 0.6);
      const dy = Math.sin(angulo) * radio * 0.7;
      punto
        .animate(
          [
            { transform: "translate(0, 0) scale(0.4)", opacity: 0 },
            {
              transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) scale(1)`,
              opacity: 1,
              offset: 0.35,
            },
            {
              transform: `translate(${dx}px, ${dy}px) scale(0)`,
              opacity: 0,
            },
          ],
          {
            duration: 640 + Math.random() * 200,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        )
        .finished.finally(() => punto.remove());
    }
  }

  const rapido = "220ms cubic-bezier(0.22, 1, 0.36, 1)";
  const lento = "560ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <nav aria-label="Principal" className="hidden md:block">
      <ul
        ref={lista}
        className="relative flex items-center"
        onPointerLeave={() => setApuntado(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setApuntado(null);
        }}
      >
        <li
          aria-hidden
          className="pointer-events-none absolute inset-y-0 rounded-pill bg-brand-tint"
          style={{
            left: caja?.izq ?? 0,
            right: caja?.der ?? 0,
            opacity: objetivo >= 0 && caja ? 1 : 0,
            transition: viaja
              ? caja?.haciaLaDerecha
                ? `left ${lento}, right ${rapido}, opacity 150ms`
                : `left ${rapido}, right ${lento}, opacity 150ms`
              : "opacity 150ms",
          }}
        />
        {ENLACES.map((enlace, i) => (
          <li key={enlace.href} className="relative">
            <Link
              ref={(el) => {
                enlaces.current[i] = el;
              }}
              href={enlace.href}
              aria-current={i === activo ? "page" : undefined}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setApuntado(i);
              }}
              onFocus={() => setApuntado(i)}
              onClick={(e) => rafaga(e.currentTarget)}
              className={cn(
                "flex h-10 items-center rounded-pill px-4 text-body-sm transition-colors duration-200",
                i === objetivo ? "text-brand" : "text-ink-secondary",
                i === activo && "font-medium",
              )}
            >
              {enlace.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** El menú del teléfono, con la cuenta fija abajo de todo. */
export function MenuDelTelefono({
  userName,
  userCara = null,
  escena,
}: {
  userName?: string | null;
  userCara?: React.ReactNode;
  escena?: Scene | null;
}) {
  const activo = useEnlaceActivo();
  const [abierto, setAbierto] = useState(false);

  const fila =
    "flex h-12 items-center rounded-pill px-4 text-body text-ink transition-colors duration-150 hover:bg-surface-sunken";

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger className="-ml-2 grid size-11 place-items-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink md:hidden">
        <Menu aria-hidden className="size-5" />
        <span className="sr-only">Abrir el menú</span>
      </SheetTrigger>
      <SheetContent lado="izquierda" closeLabel="Cerrar el menú">
        <SheetHeader className="border-b-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <Logo escena={escena} />
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6 px-4 pt-2">
          <nav aria-label="Principal">
            <ul className="flex flex-col gap-1">
              {ENLACES.map((enlace, i) => (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    aria-current={i === activo ? "page" : undefined}
                    onClick={() => setAbierto(false)}
                    className={cn(
                      fila,
                      "text-heading",
                      i === activo &&
                        "bg-brand-tint text-brand hover:bg-brand-tint",
                    )}
                  >
                    {enlace.etiqueta}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </SheetBody>
        <div className="shrink-0 border-t border-border px-4 py-3">
          <Link
            href={userName ? "/mi-cuenta" : "/ingresar"}
            onClick={() => setAbierto(false)}
            className={cn(fila, "gap-3")}
          >
            {userCara ? (
              <span className="-ml-1.5 flex">{userCara}</span>
            ) : (
              <User
                aria-hidden
                className="size-5 shrink-0 text-ink-secondary"
              />
            )}
            <span className="truncate">{userName ?? "Ingresar"}</span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
