import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Isotipo y logo — DESIGN-REFERENCE §2.3.
 * Cuadrado de esquinas redondeadas, fondo burdeos, letras blancas. La forma
 * conversa con los radios generosos del sistema.
 *
 * Nunca se deforma, ni cambia de color, ni lleva sombra.
 */
export function Logo({
  href = "/",
  wordmark = true,
  className,
}: {
  href?: string;
  /** En móvil va solo el isotipo (§2.3). */
  wordmark?: boolean;
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
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand text-caption font-semibold text-ink-inverse"
      >
        AV
      </span>
      {wordmark && (
        <span
          aria-hidden
          className="hidden text-heading text-ink sm:inline"
        >
          AnaVende
        </span>
      )}
    </Link>
  );
}
