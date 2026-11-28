"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * El fallo de una pantalla, para los `error.tsx` de la tienda y del panel.
 * Se manda a Sentry a mano: una frontera de render no pasa por
 * `onRequestError`.
 *
 * Si el sitio se actualizó con la página abierta, el botón recarga entera
 * —reintentar repetiría la llamada vieja— y no va a Sentry: es esperable.
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
  const sitioActualizado = unstable_isUnrecognizedActionError(error);

  useEffect(() => {
    if (!sitioActualizado) Sentry.captureException(error);
  }, [error, sitioActualizado]);

  if (sitioActualizado) {
    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[50svh] max-w-prose flex-col items-center justify-center gap-6 px-4 py-16 text-center"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-title text-ink">Se actualizó AnaVende</h1>
          <p className="text-body text-ink-secondary">
            Hubo una versión nueva mientras tenías esta página abierta.
            Recargala para seguir.
          </p>
        </div>
        <Button
          variant="brand"
          size="lg"
          onClick={() => window.location.reload()}
        >
          Recargar
        </Button>
      </div>
    );
  }

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
