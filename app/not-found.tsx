import Link from "next/link";

import { Button } from "@/components/ui/button";

/** También lo ve un comprador que intenta entrar a /admin (§13.7). */
export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-svh max-w-shop flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink">No encontramos esta página</h1>
        <p className="max-w-prose text-body text-ink-secondary">
          Puede que el enlace esté viejo o que el producto ya no esté publicado.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="brand" size="lg">
          <Link href="/productos">Ver los productos</Link>
        </Button>
        <Button asChild variant="tertiary" size="lg">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
