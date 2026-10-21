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
import { cn } from "@/lib/utils";

/**
 * La navegación de la tienda — DESIGN-REFERENCE §5.1 (2026-10-21).
 *
 * Tres destinos y no más: por dónde se recorre lo que hay. Lo demás —ayuda,
 * legales— vive en el pie, y en el teléfono también en el menú.
 *
 * «Ofertas» es el catálogo con el filtro de descuento puesto (RN-04b): no es
 * otra pantalla, así que «Catálogo» se marca sólo cuando ese filtro no está.
 * La ficha cuenta como catálogo: se llega desde ahí.
 */
const ENLACES = [
  {
    href: "/productos",
    etiqueta: "Catálogo",
    activo: (ruta: string, oferta: boolean) =>
      (ruta === "/productos" && !oferta) || ruta.startsWith("/productos/"),
  },
  {
    href: "/categorias",
    etiqueta: "Categorías",
    activo: (ruta: string) => ruta === "/categorias",
  },
  {
    href: "/productos?oferta=1",
    etiqueta: "Ofertas",
    activo: (ruta: string, oferta: boolean) => ruta === "/productos" && oferta,
  },
];

function useEnlaceActivo(): number {
  const ruta = usePathname();
  const oferta = useSearchParams().get("oferta") === "1";
  return ENLACES.findIndex((e) => e.activo(ruta, oferta));
}

/** Los bordes de la píldora, medidos desde los dos lados de la lista. */
type Caja = { izq: number; der: number; haciaLaDerecha: boolean };

/**
 * Los enlaces de escritorio, con la píldora que **viaja como una gota**
 * (pedido del 2026-10-21, sobre la idea del GooeyNav de React Bits).
 *
 * **El estiramiento son dos bordes con dos tiempos**: el que va adelante llega
 * en 220ms y el de atrás en 560ms, así que en el medio del viaje la píldora
 * se alarga y al llegar se recoge. Sin filtro SVG ni biblioteca: `left` y
 * `right` con transiciones distintas según hacia dónde va.
 *
 * **Sigue al mouse y al foco**, y vuelve a la página en la que se está al
 * salir de la lista: así anticipa a dónde lleva el clic. Si la página no es
 * ninguna de las tres —la home, el carrito— la píldora no está, y aparece
 * donde se apunta en vez de llegar viajando desde la nada.
 *
 * Al hacer clic suelta una ráfaga de puntos burdeos que se apagan en dos
 * tercios de segundo: es la confirmación de que el clic llegó mientras carga la página.
 * Con `prefers-reduced-motion` no hay ráfaga, y la regla global de
 * `globals.css` deja la píldora saltando de un lugar a otro.
 */
export function NavegacionPrincipal() {
  const activo = useEnlaceActivo();
  const [apuntado, setApuntado] = useState<number | null>(null);
  const objetivo = apuntado ?? activo;

  const lista = useRef<HTMLUListElement>(null);
  const enlaces = useRef<(HTMLAnchorElement | null)[]>([]);
  const [caja, setCaja] = useState<Caja | null>(null);
  // La primera vez que aparece no viaja: se enciende en su lugar. La última
  // caja con la píldora a la vista dice desde dónde viene, y se olvida al
  // apagarse.
  const [viaja, setViaja] = useState(false);
  const ultima = useRef<Caja | null>(null);

  // Se mide antes de pintar: con un efecto común se vería un cuadro con la
  // píldora en el enlace anterior. Y se vuelve a medir si la lista cambia de
  // ancho, que pasa cuando termina de cargar la fuente.
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
      // Repartidos en círculo con un poco de azar, más anchos que altos:
      // la píldora es ancha y la ráfaga sale de sus bordes.
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

/**
 * El menú del teléfono: por debajo de `md` los tres enlaces no entran al lado
 * del logo. Sale por la izquierda porque ahí está el botón que lo abre, y
 * porque la izquierda es la navegación (DESIGN.md, «Drawers»).
 *
 * Suma lo que en el teléfono ya no está en la fila —la cuenta— y lo que se
 * busca para resolver algo, que en escritorio está en el pie.
 */
export function MenuDelTelefono({ userName }: { userName?: string | null }) {
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
          <Logo />
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
          <ul className="flex flex-col gap-1 border-t border-border pt-4">
            <li>
              <Link
                href={userName ? "/mi-cuenta" : "/ingresar"}
                onClick={() => setAbierto(false)}
                className={cn(fila, "gap-3")}
              >
                <User aria-hidden className="size-5 text-ink-secondary" />
                <span className="truncate">{userName ?? "Ingresar"}</span>
              </Link>
            </li>
            <li>
              <Link
                href="/contacto"
                onClick={() => setAbierto(false)}
                className={fila}
              >
                Contacto
              </Link>
            </li>
            <li>
              <Link
                href="/legales/como-comprar"
                onClick={() => setAbierto(false)}
                className={fila}
              >
                Cómo comprar
              </Link>
            </li>
          </ul>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
