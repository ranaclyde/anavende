"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { unstable_isUnrecognizedActionError } from "next/navigation";
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
 *
 * **Salvo cuando el sitio se actualizó** (2026-11-17). Una página abierta
 * antes de un despliegue llama a las Server Actions con los códigos de su
 * build, y el servidor nuevo no los reconoce: no falló nada de nuestro lado,
 * la página quedó vieja. «Probar de nuevo» repetiría la misma llamada vieja,
 * así que el botón recarga la página entera. Y no va a Sentry: es lo
 * esperable después de cada despliegue, y reportarlo es ruido que tapa los
 * errores de verdad.
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
