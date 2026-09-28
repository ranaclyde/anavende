"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { inter } from "@/lib/fuente";

import "./globals.css";

/**
 * Lo que se ve cuando falla el layout raíz — F1.15, DESIGN-REFERENCE §8 y §10.
 *
 * Reemplaza al layout entero, así que no hereda nada de él: por eso declara
 * su propio `<html>` y `<body>`, importa la hoja global y carga Inter. Sin
 * eso los tokens no existen y la página sale en Times sobre blanco.
 *
 * El error se manda a mano porque un error de render que atrapa esta frontera
 * no pasa por `onRequestError` de `instrumentation.ts`: ese solo ve los del
 * servidor. Viaja por el mismo filtro de datos personales que todo lo demás
 * (`beforeSend` en `instrumentation-client.ts`).
 */
export default function ErrorGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es-AR" className={inter.variable}>
      <body>
        <title>Algo falló · AnaVende</title>
        <main className="mx-auto flex min-h-svh max-w-shop flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-title text-ink">Algo falló de nuestro lado</h1>
            <p className="max-w-prose text-body text-ink-secondary">
              No es nada que hayas hecho vos. Probá de nuevo en un momento.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="brand" size="lg" onClick={() => retry()}>
              Probar de nuevo
            </Button>
            <Button asChild variant="tertiary" size="lg">
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
