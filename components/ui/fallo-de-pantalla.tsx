"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Lo que se ve cuando falla UNA pantalla — DESIGN-REFERENCE §8 y §10, F10.7.
 *
 * Lo usan los `error.tsx` de la tienda y del panel. Hasta F10.7 no había
 * ninguno, así que cualquier pantalla que fallara —la base que no contesta,
 * por ejemplo— caía en `global-error.tsx`, que reemplaza el sitio entero: sin
 * encabezado, sin menú, sin carrito. Con esto el error queda en el lugar del
 * contenido y lo demás sigue andando.
 *
 * Dice lo mismo que el global —qué pasó, que no es culpa de quien lo ve, y
 * qué hacer—, con «Probar de nuevo», que vuelve a pedir los datos (`retry`,
 * Next 16.3). El error se manda a Sentry a mano por la misma razón que en el
 * global: una frontera de render no pasa por `onRequestError`.
 */
export function FalloDePantalla({
  error,
  retry,
  inicio,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  /** La salida si reintentar no alcanza. */
  inicio: { href: string; texto: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[50svh] max-w-prose flex-col items-center justify-center gap-6 px-4 py-16 text-center"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink">Algo falló de nuestro lado</h1>
        <p className="text-body text-ink-secondary">
          No es nada que hayas hecho vos. Probá de nuevo en un momento.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="brand" size="lg" onClick={() => retry()}>
          Probar de nuevo
        </Button>
        <Button asChild variant="tertiary" size="lg">
          <Link href={inicio.href}>{inicio.texto}</Link>
        </Button>
      </div>
    </div>
  );
}
