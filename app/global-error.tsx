"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { inter } from "@/lib/fuente";

import "./globals.css";

/**
 * Reemplaza al layout raíz entero: por eso declara `<html>`, importa la hoja
 * global y carga Inter. El error va a Sentry a mano porque `onRequestError`
 * solo ve los del servidor.
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
