"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

/**
 * La foto que viaja de la tarjeta a la ficha (2026-10-20).
 *
 * Al tocar una tarjeta, su foto vuela hasta el lugar de la foto grande de la
 * ficha: es el mismo producto, y el movimiento lo dice sin que haya que
 * buscarlo en la pantalla nueva. Lo anima el navegador con View Transitions;
 * sin soporte, o con `prefers-reduced-motion`, el enlace navega como siempre.
 *
 * **La transición la arranca el enlace, y no el `<ViewTransition>` de
 * React.** Se probó primero con React y fallaba según dónde estuviera la
 * tarjeta: React solo anima la entrada de lo que está DENTRO de la pantalla al
 * cambiar, y al tocar una tarjeta de más abajo en el catálogo, la galería de
 * la ficha nueva todavía está arriba, fuera de la vista —Next sube el scroll
 * después—. Acá el enlace navega adentro de `document.startViewTransition` y
 * espera a que aparezca el lugar donde aterriza la foto; los nombres van como
 * estilo en línea, así que la pareja la arma el navegador.
 *
 * **Aterriza en el esqueleto o en la galería**, lo que llegue primero. Al
 * tocar, Next suele dibujar `loading.tsx` antes que la ficha: por eso el
 * enlace anota qué foto tenía —la URL que el navegador ya bajó, sin segunda
 * descarga— y el esqueleto la dibuja en el cuadrado grande. Si la ficha llega
 * en el mismo cuadro, la recibe la galería.
 *
 * **El nombre se le pone a la tarjeta tocada, al tocarla**, y no a todas de
 * entrada: en la home un producto puede estar en dos secciones, y dos
 * elementos con el mismo nombre cortan la transición.
 */

/** El nombre de la transición de un producto. El prefijo evita que un slug que empiece con un número sea un nombre inválido. */
function nombreDeFoto(slug: string): string {
  return `foto-${slug}`;
}

/**
 * Cuánto se espera a que aparezca el lugar de llegada. Mientras tanto la
 * pantalla queda congelada en la foto vieja —así funcionan las View
 * Transitions—, así que el tope es corto: si el servidor tarda más, la
 * navegación sigue sin la foto volando.
 */
const ESPERA_MAXIMA = 400;

/** La última foto tocada. Vive en el módulo: es de esta pestaña y de esta navegación. */
let ultima: { slug: string; src: string } | null = null;

/**
 * Los atributos del lugar donde aterriza la foto de `slug`, o nada si no se
 * llegó tocando su tarjeta. En el servidor y en la primera carga `ultima`
 * está vacía, así que no cambia nada al hidratar.
 */
export function llegadaDeLaFoto(slug: string): {
  style?: CSSProperties;
  "data-foto-llega"?: string;
} {
  if (ultima?.slug !== slug) return {};
  return {
    // `view-transition-class` todavía no está en los tipos de React, y es lo
    // que toma `::view-transition-group(.foto)` en `globals.css`.
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

/**
 * El enlace estirado de la tarjeta (`tarjeta-producto.tsx`). Es el único
 * pedazo de cliente de la tarjeta, que sigue siendo servidor.
 */
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
    // Abrir en otra pestaña no es esta navegación: no hay nada que animar.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    if (!document.startViewTransition || sinMovimiento()) return;

    const foto = e.currentTarget
      .closest("article")
      ?.querySelector<HTMLImageElement>("img[data-foto-tarjeta]");
    if (!foto?.currentSrc) return;

    // Desde acá la navegación es nuestra: `Link` no navega si el clic ya
    // está atendido.
    e.preventDefault();
    ultima = { slug, src: foto.currentSrc };
    foto.style.setProperty("view-transition-name", nombreDeFoto(slug));
    foto.style.setProperty("view-transition-class", "foto");

    const transicion = document.startViewTransition(
      () =>
        new Promise<void>((listo) => {
          router.push(href);
          const limite = performance.now() + ESPERA_MAXIMA;
          // `setTimeout` y no `requestAnimationFrame`: mientras dura esta
          // espera el navegador no dibuja, y los cuadros no corren.
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
 * El cuadrado grande del esqueleto de la ficha. Si se llegó tocando la
 * tarjeta de ESTE producto, dibuja su foto; si no —un enlace compartido, una
 * recarga—, el esqueleto de siempre.
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
      {/*
        `<img>` y no `next/image`: la URL es la que ya bajó la tarjeta, tal
        cual, y el optimizador pediría otra.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ultima.src} alt="" className="size-full object-contain" />
    </div>
  );
}
