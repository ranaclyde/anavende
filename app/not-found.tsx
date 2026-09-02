import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * DESIGN-REFERENCE §8 y §10: dice qué pasó y ofrece la acción, sin código
 * ni jerga. Es también lo que ve un comprador que intenta entrar a /admin:
 * para él, esa sección no existe (TECHNICAL-SPEC §13.7).
 */
export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-svh max-w-shop flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink">No encontramos esta página</h1>
        <p className="max-w-prose text-body text-ink-secondary">
          Puede que el enlace esté viejo o que el producto ya no esté
          publicado.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="brand" size="lg">
          <Link href="/productos">Ver el catálogo</Link>
        </Button>
        <Button asChild variant="tertiary" size="lg">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
