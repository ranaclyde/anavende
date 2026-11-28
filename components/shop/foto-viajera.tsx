"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

/**
 * La foto que viaja de la tarjeta a la ficha, con View Transitions del
 * navegador. Sin soporte o con `prefers-reduced-motion`, navega como siempre.
 *
 * La arranca el enlace y no el `<ViewTransition>` de React: React solo anima
 * lo que está dentro de la pantalla, y la galería de la ficha nueva queda
 * fuera de la vista hasta que Next sube el scroll.
 *
 * Aterriza en el esqueleto (`loading.tsx`) o en la galería, lo que llegue
 * primero. El nombre se pone solo a la tarjeta tocada: en la home un producto
 * puede estar dos veces, y dos nombres iguales cortan la transición.
 */

/** El prefijo evita que un slug que empiece con un número sea un nombre inválido. */
function nombreDeFoto(slug: string): string {
  return `foto-${slug}`;
}

/**
 * Tope de espera del lugar de llegada: mientras tanto la pantalla queda
 * congelada, así que es corto. Si el servidor tarda más, sigue sin animar.
 */
const ESPERA_MAXIMA = 400;

/** La última foto tocada; vive en el módulo porque es de esta pestaña. */
let ultima: { slug: string; src: string } | null = null;

/**
 * Los atributos del lugar donde aterriza la foto de `slug`, o nada si no se
 * llegó tocando su tarjeta. En el servidor `ultima` está vacía: no rompe la
 * hidratación.
 */
export function llegadaDeLaFoto(slug: string): {
  style?: CSSProperties;
  "data-foto-llega"?: string;
} {
  if (ultima?.slug !== slug) return {};
  return {
    // `viewTransitionClass` todavía no está en los tipos de React.
    style: {
      viewTransitionName: nombreDeFoto(slug),
      viewTransitionClass: "foto",
    } as CSSProperties,
    "data-foto-llega": slug,
  };
}

function sinMovimiento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** El enlace estirado de la tarjeta, su único pedazo de cliente. */
export function EnlaceDeTarjeta({
  href,
  slug,
  className,
  children,
}: {
  href: string;
  slug: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function alTocar(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    if (!document.startViewTransition || sinMovimiento()) return;

    const foto = e.currentTarget
      .closest("article")
      ?.querySelector<HTMLImageElement>("img[data-foto-tarjeta]");
    if (!foto?.currentSrc) return;

    // `Link` no navega si el clic ya está atendido.
    e.preventDefault();
    ultima = { slug, src: foto.currentSrc };
    foto.style.setProperty("view-transition-name", nombreDeFoto(slug));
    foto.style.setProperty("view-transition-class", "foto");

    const transicion = document.startViewTransition(
      () =>
        new Promise<void>((listo) => {
          router.push(href);
          const limite = performance.now() + ESPERA_MAXIMA;
          // `setTimeout` y no `requestAnimationFrame`: durante la espera el
          // navegador no dibuja, y los cuadros no corren.
          const buscar = () => {
            const llego = document.querySelector(
              `[data-foto-llega="${CSS.escape(slug)}"]`,
            );
            if (llego || performance.now() > limite) listo();
            else window.setTimeout(buscar, 16);
          };
          buscar();
        }),
    );

    // Si la página vuelve del historial, la tarjeta no tiene que llegar con
    // el nombre puesto.
    void transicion.finished.finally(() => {
      foto.style.removeProperty("view-transition-name");
      foto.style.removeProperty("view-transition-class");
    });
  }

  return (
    <Link
      href={href}
      onClick={alTocar}
      data-enlace-tarjeta
      className={className}
    >
      {children}
    </Link>
  );
}

/**
 * El cuadrado grande del esqueleto de la ficha: la foto si se llegó tocando
 * la tarjeta de este producto, o el esqueleto de siempre.
 */
export function FotoQueLlega({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const slug = usePathname().split("/")[2];
  if (!ultima || ultima.slug !== slug) return children;

  return (
    <div className={className} {...llegadaDeLaFoto(slug)}>
      {/* `<img>`: la URL es la que ya bajó la tarjeta; `next/image` pediría otra. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ultima.src} alt="" className="size-full object-contain" />
    </div>
  );
}
