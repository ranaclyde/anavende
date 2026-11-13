import Link from "next/link";

import { AdornoDeTemporada } from "@/components/shop/adorno-de-temporada";
import type { Escena } from "@/lib/escenas";
import { LADO_DEL_ISOTIPO, PALABRA, PIEZAS } from "@/lib/marca";
import { AREA_TACTIL_CUADRADA, cn } from "@/lib/utils";

/**
 * Isotipo, palabra y logo — DESIGN-REFERENCE §2.3, F10.7c.
 *
 * El isotipo es la cuadrícula de cuatro celdas —A, joystick, auriculares, V—
 * y la palabra es «AnaVende» en la misma letra que la A y la V. Los dos se
 * dibujan en línea desde `lib/marca.ts`, con el color del texto: burdeos
 * (`text-logo`), blanco en el panel oscuro —el mismo token cambia— y blanco
 * sobre el pie (`claro`). Sin imagen que pedir ni dos versiones en el árbol.
 *
 * Nunca se deforma, ni cambia de color, ni lleva sombra.
 */

const VISTA_DEL_ISOTIPO = `0 0 ${LADO_DEL_ISOTIPO} ${LADO_DEL_ISOTIPO}`;
const VISTA_DE_LA_PALABRA = PALABRA.caja.join(" ");
const TRAZOS = Object.values(PIEZAS);

/**
 * El isotipo solo, sin enlace. 32px es el tamaño de uso (§2.3); se cambia
 * con `className`.
 */
export function Isotipo({
  claro = false,
  className,
}: {
  /** Sobre fondo oscuro de la tienda: el pie. */
  claro?: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={VISTA_DEL_ISOTIPO}
      className={cn(
        "size-8 shrink-0",
        claro ? "text-ink-inverse" : "text-logo",
        className,
      )}
    >
      <g fill="currentColor" fillRule="evenodd">
        {TRAZOS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * «AnaVende» en trazo. Su mayúscula mide el 45 % del isotipo y la separación
 * es el 30 % (`HORIZONTAL` en `lib/marca.ts`): las dos salen de `--isotipo`,
 * el lado del isotipo que la acompaña.
 */
function Palabra({ claro = false }: { claro?: boolean }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={VISTA_DE_LA_PALABRA}
      // 0,45 de mayúscula por 1,018: la caja incluye lo que la «e» y la «d»
      // bajan de la línea de base.
      className={cn(
        "h-[calc(var(--isotipo)*0.458)] w-auto shrink-0",
        claro ? "text-ink-inverse" : "text-logo",
      )}
    >
      <path fill="currentColor" d={PALABRA.d} />
    </svg>
  );
}

/**
 * La versión horizontal: isotipo y palabra, sin enlace. Para donde la marca
 * va con su nombre siempre a la vista —ingreso, mantenimiento, pie, panel—.
 */
export function LogoHorizontal({
  claro = false,
  className,
}: {
  claro?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[calc(var(--isotipo)*0.3)] [--isotipo:2rem]",
        className,
      )}
    >
      <Isotipo claro={claro} className="size-(--isotipo)" />
      <Palabra claro={claro} />
    </span>
  );
}

/** El logo del encabezado de la tienda, con su enlace al inicio. */
export function Logo({
  href = "/",
  escena = null,
  className,
}: {
  href?: string;
  /** La de hoy, si hay (F9.5): el isotipo lleva su adorno encima. */
  escena?: Escena | null;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-[calc(var(--isotipo)*0.3)] rounded-pill [--isotipo:2rem]",
        // Con la palabra oculta queda un enlace de 32×32, por debajo de los
        // 44 de §9. La marca no se agranda —§2.3 fija ese tamaño de uso—, así
        // que lo que crece es la zona que responde al dedo.
        AREA_TACTIL_CUADRADA,
        className,
      )}
      aria-label="AnaVende, ir al inicio"
    >
      <span className="relative grid shrink-0">
        <Isotipo />
        {escena ? <AdornoDeTemporada escena={escena} /> : null}
      </span>
      {/* En el teléfono va solo el isotipo (§2.3). */}
      <span className="hidden sm:contents">
        <Palabra />
      </span>
    </Link>
  );
}
