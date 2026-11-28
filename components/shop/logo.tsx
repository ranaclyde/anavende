import Link from "next/link";

import { AdornoDeTemporada } from "@/components/shop/adorno-de-temporada";
import type { Scene } from "@/lib/scenes";
import { MARK_SIZE, WORDMARK, PIECES } from "@/lib/logo";
import { SQUARE_TOUCH_AREA, cn } from "@/lib/utils";

/**
 * Isotipo, palabra y logo (DESIGN-REFERENCE §2.3), en línea desde
 * `lib/logo.ts` y con el color del texto.
 */

const VISTA_DEL_ISOTIPO = `0 0 ${MARK_SIZE} ${MARK_SIZE}`;
const VISTA_DE_LA_PALABRA = WORDMARK.box.join(" ");
const TRAZOS = Object.values(PIECES);

/** El isotipo solo, sin enlace. */
export function Isotipo({
  claro = false,
  className,
}: {
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

/** «AnaVende» en trazo, medida contra `--isotipo` (`HORIZONTAL` en `lib/logo.ts`). */
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
      <path fill="currentColor" d={WORDMARK.d} />
    </svg>
  );
}

/** Isotipo y palabra, sin enlace. */
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

/** El logo del encabezado, con su enlace al inicio: solo el isotipo. */
export function Logo({
  href = "/",
  escena = null,
  className,
}: {
  href?: string;
  escena?: Scene | null;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-pill",
        SQUARE_TOUCH_AREA,
        className,
      )}
      aria-label="AnaVende, ir al inicio"
    >
      <span className="relative grid shrink-0">
        <Isotipo />
        {escena ? <AdornoDeTemporada escena={escena} /> : null}
      </span>
    </Link>
  );
}
