import type { Metadata } from "next";
import Link from "next/link";

import { LogoHorizontal } from "@/components/shop/logo";
import { NO_INDEX } from "@/lib/seo";

// Se hereda campo por campo: las páginas siguen poniendo su título.
export const metadata: Metadata = { robots: NO_INDEX };

/** `<LogoHorizontal>` y no `<Logo>`, que oculta la palabra debajo de `sm`. */
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
        <LogoHorizontal />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
