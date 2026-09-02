import Link from "next/link";

/**
 * Layout de identidad — pantallas de ingreso, registro y recuperación.
 * Sin encabezado ni pie de tienda: acá no se está explorando
 * (DESIGN-REFERENCE §5.1).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2.5 rounded-pill"
        aria-label="AnaVende, ir a la tienda"
      >
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-[10px] bg-brand text-caption font-semibold text-ink-inverse"
        >
          AV
        </span>
        <span className="text-heading text-ink">AnaVende</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
