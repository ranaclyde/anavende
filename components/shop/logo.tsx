import Image from "next/image";
import Link from "next/link";

import isotipo from "@/public/marca/logo.png";
import isotipoClaro from "@/public/marca/logo-claro.png";
import { cn } from "@/lib/utils";

/**
 * Isotipo y logo — DESIGN-REFERENCE §2.3.
 *
 * El isotipo es la cuadrícula de cuatro celdas —A, joystick, auriculares, V—
 * en burdeos sobre transparente. Sobre fondo oscuro se usa la versión clara,
 * derivada del original con `scripts/derivar-logo.mts`: el burdeos sobre el
 * pie casi negro no se lee.
 *
 * Nunca se deforma, ni cambia de color, ni lleva sombra. Por eso la imagen va
 * en una caja cuadrada con `object-contain` y no estirada: el original no es
 * exactamente cuadrado (1180×1128).
 */
export function Logo({
  href = "/",
  wordmark = true,
  claro = false,
  className,
}: {
  href?: string;
  /** En móvil va solo el isotipo (§2.3). */
  wordmark?: boolean;
  /** Sobre fondo oscuro: pie del sitio. */
  claro?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 rounded-pill",
        className,
      )}
      aria-label="AnaVende, ir al inicio"
    >
      <Isotipo claro={claro} />
      {wordmark && (
        <span
          aria-hidden
          className={cn(
            "hidden text-heading sm:inline",
            claro ? "text-ink-inverse" : "text-ink",
          )}
        >
          AnaVende
        </span>
      )}
    </Link>
  );
}

/**
 * El isotipo solo, sin enlace. Lo usan el pie y el menú del panel, que ya
 * tienen su propio enlace alrededor.
 */
export function Isotipo({
  claro = false,
  className,
}: {
  claro?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={claro ? isotipoClaro : isotipo}
      alt=""
      aria-hidden
      // 32px es el tamaño de uso (§2.3); `sizes` evita que Next sirva el
      // original de 1180px para pintarlo a 32.
      sizes="32px"
      priority
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  );
}

/**
 * El isotipo que sigue al tema del panel.
 *
 * El burdeos del original da 1,83:1 sobre la superficie oscura —el propio
 * §3.2 lo dice al aclarar `--brand` para modo oscuro—, así que ahí va la
 * versión clara. El cambio lo hace CSS con las dos imágenes en el árbol: el
 * tema es un atributo que se resuelve en el navegador, y elegir en el
 * servidor produciría el logo equivocado durante el primer pintado.
 */
export function IsotipoSegunTema({ className }: { className?: string }) {
  return (
    <>
      <Isotipo className={cn("dark:hidden", className)} />
      <Isotipo claro className={cn("hidden dark:block", className)} />
    </>
  );
}
